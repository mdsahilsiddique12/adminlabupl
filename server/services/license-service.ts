import { PrismaClient } from '@prisma/client';
import { rsaKeyManager } from '../utils/rsa-keys';
import { LicenseStatus } from '@prisma/client';
import crypto from 'crypto';

interface LicenseData {
  licenseKey: string;
  userId: string | null;
  planId: string | null;
  expiresAt: Date;
  deviceFingerprint: string;
}

interface CreateLicenseRequest {
  userId: string;
  planId: string;
  deviceId?: string;
  deviceFingerprint?: string;
  expiresAt?: Date;
  status?: LicenseStatus;
  transactionId?: string;
  paymentMode?: string;
  paymentVerified?: boolean;
}

export class LicenseService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate a unique license key
   */
  generateLicenseKey(planName: string): string {
    const prefix = 'LIC';
    const planCode = this.getPlanCode(planName);
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const timestamp = Date.now().toString(36).substring(0, 4).toUpperCase();
    return `${prefix}-${planCode}-${randomPart}-${timestamp}`;
  }

  /**
   * Create a new license with RSA signature
   */
  async createLicense(
    request: CreateLicenseRequest
  ) {
    const {
      userId,
      planId,
      deviceId,
      deviceFingerprint,
      status,
      transactionId,
      paymentMode,
      paymentVerified
    } = request;

    // Check if user exists and has permission
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Check if plan exists
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Generate license key
    const licenseKey = this.generateLicenseKey(plan.name);
    
    // Always derive validity from the selected plan's duration.
    const expirationDate = this.calculateExpiryDate(plan.durationDays);

    if (!deviceId && !deviceFingerprint) {
      throw new Error('Device is required to create a license');
    }

    // Resolve device binding (mandatory)
    let resolvedDevice = null as Awaited<ReturnType<typeof this.prisma.device.findUnique>> | null;
    if (deviceId) {
      resolvedDevice = await this.prisma.device.findUnique({ where: { id: deviceId } });
      if (!resolvedDevice) {
        throw new Error('Device not found');
      }
    } else if (deviceFingerprint) {
      resolvedDevice = await this.prisma.device.upsert({
        where: { fingerprint: deviceFingerprint },
        update: { lastSeen: new Date() },
        create: {
          fingerprint: deviceFingerprint,
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: false
        }
      });
    }

    if (!resolvedDevice) {
      throw new Error('Unable to resolve device');
    }

    // Create license data for signing
    const licenseData: LicenseData = {
      licenseKey,
      userId,
      planId,
      expiresAt: expirationDate,
      deviceFingerprint: resolvedDevice.fingerprint
    };

    // Sign the license data
    const signature = this.signLicenseData(licenseData);

    // Create the license
    const license = await this.prisma.license.create({
      data: {
        licenseKey,
        userId,
        planId,
        deviceId: resolvedDevice.id,
        status: status ?? LicenseStatus.PENDING,
        expiresAt: expirationDate,
        transactionId,
        paymentMode,
        paymentVerified: paymentVerified ?? false,
        signature,
        activationDate: status === LicenseStatus.ACTIVE ? new Date() : null,
        lastValidated: null
      },
      include: {
        user: true,
        plan: true,
        device: true
      }
    });

    // Log the creation
    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'Create License',
        details: `Created license ${licenseKey} for plan ${plan.name}`,
        ipAddress: '',
        userAgent: ''
      }
    });

    return license;
  }

  /**
   * Mark licenses as expired when their validity date has passed.
   */
  async expireDueLicenses(): Promise<number> {
    const result = await this.prisma.license.updateMany({
      where: {
        expiresAt: { lte: new Date() },
        status: { in: [LicenseStatus.ACTIVE, LicenseStatus.PENDING] }
      },
      data: {
        status: LicenseStatus.EXPIRED
      }
    });

    return result.count;
  }

  /**
   * Validate a license key and device
   */
  async validateLicense(
    licenseKey: string,
    deviceFingerprint: string,
    ipAddress: string,
    userAgent: string
  ) {
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        user: true,
        plan: true,
        device: true
      }
    });

    if (!license) {
      throw new Error('Invalid license key');
    }

    // Enforce manual payment verification
    if (!license.paymentVerified) {
      throw new Error('Payment not verified for this license');
    }

    if (this.isPastExpiry(license.expiresAt)) {
      if (license.status !== LicenseStatus.EXPIRED) {
        await this.prisma.license.update({
          where: { id: license.id },
          data: { status: LicenseStatus.EXPIRED }
        });
      }
      throw new Error('License has expired');
    }

    // Check if license is active and not suspended
    if (license.status === LicenseStatus.SUSPENDED) {
      throw new Error('License is suspended');
    }
    if (license.status !== LicenseStatus.ACTIVE) {
      throw new Error(`License is ${license.status.toLowerCase()}`);
    }

    if (!license.device || license.device.fingerprint !== deviceFingerprint) {
      throw new Error('Device does not match this license');
    }

    if (!license.device.isActive) {
      throw new Error('Device is not approved by admin');
    }

    // Verify RSA signature
    const licenseData: LicenseData = {
      licenseKey: license.licenseKey,
      userId: license.userId,
      planId: license.planId,
      expiresAt: license.expiresAt!,
      deviceFingerprint: license.device.fingerprint
    };

    if (!this.verifyLicenseSignature(licenseData, license.signature!)) {
      throw new Error('Invalid license signature');
    }

    // Update last validation
    await this.prisma.license.update({
      where: { id: license.id },
      data: { lastValidated: new Date() }
    });

    // Update device last seen
    if (license.deviceId) {
      await this.prisma.device.update({
        where: { id: license.deviceId },
        data: { lastSeen: new Date() }
      });
    }

    // Log the validation
    await this.prisma.activityLog.create({
      data: {
        userId: license.userId,
        action: 'Validate License',
        details: `Validated license ${licenseKey}`,
        ipAddress,
        userAgent
      }
    });

    return {
      valid: true,
      license,
      plan: license.plan,
      user: license.user,
      validationToken: this.createValidationToken(license)
    };
  }

  /**
   * Activate a license for a specific device
   */
  async activateLicense(
    licenseKey: string,
    deviceFingerprint: string,
    ipAddress: string,
    userAgent: string
  ) {
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        device: true
      }
    });

    if (!license) {
      throw new Error('Invalid license key');
    }

    if (!license.paymentVerified) {
      throw new Error('Payment not verified for this license');
    }

    if (license.status === LicenseStatus.SUSPENDED) {
      throw new Error('License is suspended');
    }

    if (this.isPastExpiry(license.expiresAt)) {
      if (license.status !== LicenseStatus.EXPIRED) {
        await this.prisma.license.update({
          where: { id: license.id },
          data: { status: LicenseStatus.EXPIRED }
        });
      }
      throw new Error('License has expired');
    }

    const now = new Date();

    // Create or update device
    const device = await this.prisma.device.upsert({
      where: { fingerprint: deviceFingerprint },
      update: { lastSeen: now, ipAddress, userAgent },
      create: {
        fingerprint: deviceFingerprint,
        ipAddress,
        userAgent,
        firstSeen: now,
        lastSeen: now
      }
    });

    if (!device.isActive) {
      // If this exact device was previously blocked/logged out, allow clean reconnect.
      if (license.deviceId && license.deviceId === device.id) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { isActive: true, lastSeen: now, ipAddress, userAgent }
        });
      } else {
        throw new Error('Device is pending admin approval');
      }
    }

    if (license.deviceId && license.deviceId !== device.id) {
      const previouslyBoundDevice = license.deviceId
        ? await this.prisma.device.findUnique({ where: { id: license.deviceId } })
        : null;

      // Allow transfer when the previously bound device was blocked/logged out by admin.
      if (!previouslyBoundDevice || !previouslyBoundDevice.isActive) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { isActive: true, lastSeen: now, ipAddress, userAgent }
        });
      } else {
        throw new Error('License is already activated on another device');
      }
    }

    const licenseData: LicenseData = {
      licenseKey: license.licenseKey,
      userId: license.userId,
      planId: license.planId,
      expiresAt: license.expiresAt!,
      deviceFingerprint: device.fingerprint
    };

    // Update license with device
    const updatedLicense = await this.prisma.license.update({
      where: { id: license.id },
      data: {
        deviceId: device.id,
        status: LicenseStatus.ACTIVE,
        activationDate: now,
        signature: this.signLicenseData(licenseData)
      },
      include: {
        user: true,
        plan: true
      }
    });

    // Log the activation
    await this.prisma.activityLog.create({
      data: {
        userId: license.userId,
        action: 'Activate License',
        details: `Activated license ${licenseKey} on device ${deviceFingerprint}`,
        ipAddress,
        userAgent
      }
    });

    return updatedLicense;
  }

  /**
   * Check for trial eligibility
   */
  async checkTrialEligibility(email: string, ipAddress: string): Promise<boolean> {
    // Check if user already has a trial
    const existingTrials = await this.prisma.activityLog.count({
      where: {
        action: 'Trial Activation',
        details: {
          contains: email
        }
      }
    });

    if (existingTrials > 0) {
      return false;
    }

    // Check IP address for multiple trials
    const ipTrials = await this.prisma.activityLog.count({
      where: {
        action: 'Trial Activation',
        ipAddress
      }
    });

    if (ipTrials > 2) { // Max 2 trials per IP
      return false;
    }

    return true;
  }

  /**
   * Create a trial license
   */
  async createTrialLicense(userId: string, ipAddress: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Find trial plan (usually free or low-cost)
    const trialPlan = await this.prisma.plan.findFirst({
      where: {
        price: 0, // Free trial plan
        name: { contains: 'Trial' }
      }
    });

    if (!trialPlan) {
      throw new Error('No trial plan available');
    }

    const trialLicense = await this.createLicense({
      userId,
      planId: trialPlan.id,
      deviceFingerprint: `trial-${userId}`,
      status: LicenseStatus.ACTIVE,
      paymentVerified: true,
      paymentMode: 'trial'
    });

    // Log trial activation
    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'Trial Activation',
        details: `Trial license ${trialLicense.licenseKey} created for ${user.email}`,
        ipAddress,
        userAgent: ''
      }
    });

    return trialLicense.licenseKey;
  }

  /**
   * Suspend a license
   */
  async suspendLicense(licenseId: string, reason: string, adminUserId: string): Promise<void> {
    await this.prisma.license.update({
      where: { id: licenseId },
      data: { status: LicenseStatus.SUSPENDED }
    });

    // Log the suspension
    await this.prisma.activityLog.create({
      data: {
        userId: adminUserId,
        action: 'Suspend License',
        details: `Suspended license ${licenseId} for reason: ${reason}`,
        ipAddress: '',
        userAgent: ''
      }
    });
  }

  /**
   * Get license usage statistics
   */
  async getLicenseStats() {
    const totalLicenses = await this.prisma.license.count();
    const activeLicenses = await this.prisma.license.count({
      where: { status: LicenseStatus.ACTIVE }
    });
    const expiredLicenses = await this.prisma.license.count({
      where: { status: LicenseStatus.EXPIRED }
    });
    const suspendedLicenses = await this.prisma.license.count({
      where: { status: LicenseStatus.SUSPENDED }
    });

    return {
      total: totalLicenses,
      active: activeLicenses,
      expired: expiredLicenses,
      suspended: suspendedLicenses
    };
  }

  /**
   * Sign license data with RSA private key
   */
  private signLicenseData(data: LicenseData): string {
    const dataString = JSON.stringify(data);
    return rsaKeyManager.sign(dataString);
  }

  /**
   * Verify license signature with RSA public key
   */
  private verifyLicenseSignature(data: LicenseData, signature: string): boolean {
    const dataString = JSON.stringify(data);
    return rsaKeyManager.verify(dataString, signature);
  }

  private createValidationToken(license: {
    id: string;
    licenseKey: string;
    deviceId: string | null;
    expiresAt: Date | null;
    paymentVerified: boolean;
    status: LicenseStatus;
  }): { payload: string; signature: string } {
    const payload = JSON.stringify({
      licenseId: license.id,
      licenseKey: license.licenseKey,
      deviceId: license.deviceId,
      expiresAt: license.expiresAt,
      paymentVerified: license.paymentVerified,
      status: license.status,
      issuedAt: new Date().toISOString()
    });

    return {
      payload,
      signature: rsaKeyManager.sign(payload)
    };
  }

  /**
   * Generate device fingerprint from request data
   */
  static generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const data = `${userAgent}-${ipAddress}-${process.env.NODE_ENV || 'development'}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateExpiryDate(durationDays: number): Date {
    return new Date(Date.now() + (durationDays * 24 * 60 * 60 * 1000));
  }

  private isPastExpiry(expiresAt: Date | null): boolean {
    return !!expiresAt && expiresAt <= new Date();
  }

  private getPlanCode(planName: string): string {
    const normalized = planName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!normalized) {
      return 'GEN';
    }
    return normalized.slice(0, 4).padEnd(4, 'X');
  }
}
