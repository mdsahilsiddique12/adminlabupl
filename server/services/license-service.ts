import { PrismaClient } from '@prisma/client';
import { rsaKeyManager } from '../utils/rsa-keys';
import { v4 as uuidv4 } from 'uuid';
import { LicenseStatus, UserRole } from '@prisma/client';
import crypto from 'crypto';

interface LicenseData {
  licenseKey: string;
  userId: string;
  planId: string;
  expiresAt: Date;
  deviceFingerprint?: string;
}

interface DeviceFingerprint {
  fingerprint: string;
  ipAddress: string;
  userAgent: string;
}

export class LicenseService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate a unique license key
   */
  generateLicenseKey(): string {
    const prefix = 'LIC';
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const timestamp = Date.now().toString(36).substring(0, 4).toUpperCase();
    return `${prefix}-${randomPart}-${timestamp}`;
  }

  /**
   * Create a new license with RSA signature
   */
  async createLicense(
    userId: string,
    planId: string,
    deviceFingerprint?: string,
    expiresAt?: Date
  ) {
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
    const licenseKey = this.generateLicenseKey();
    
    // Set expiration date (default to plan duration)
    const expirationDate = expiresAt || new Date(Date.now() + (plan.durationDays * 24 * 60 * 60 * 1000));

    // Create device if fingerprint provided
    let deviceId: string | undefined;
    if (deviceFingerprint) {
      const device = await this.prisma.device.upsert({
        where: { fingerprint: deviceFingerprint },
        update: { lastSeen: new Date() },
        create: {
          fingerprint: deviceFingerprint,
          firstSeen: new Date(),
          lastSeen: new Date()
        }
      });
      deviceId = device.id;
    }

    // Create license data for signing
    const licenseData: LicenseData = {
      licenseKey,
      userId,
      planId,
      expiresAt: expirationDate,
      deviceFingerprint
    };

    // Sign the license data
    const signature = this.signLicenseData(licenseData);

    // Create the license
    const license = await this.prisma.license.create({
      data: {
        licenseKey,
        userId,
        planId,
        deviceId,
        status: LicenseStatus.ACTIVE,
        expiresAt: expirationDate,
        signature,
        activationDate: new Date(),
        lastValidated: new Date()
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

    // Check if license is active
    if (license.status !== LicenseStatus.ACTIVE) {
      throw new Error(`License is ${license.status.toLowerCase()}`);
    }

    // Check expiration
    if (license.expiresAt && license.expiresAt < new Date()) {
      // Auto-expire the license
      await this.prisma.license.update({
        where: { id: license.id },
        data: { status: LicenseStatus.EXPIRED }
      });
      throw new Error('License has expired');
    }

    // Verify RSA signature
    const licenseData: LicenseData = {
      licenseKey: license.licenseKey,
      userId: license.userId,
      planId: license.planId,
      expiresAt: license.expiresAt!,
      deviceFingerprint: license.device?.fingerprint
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
      user: license.user
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

    // Check if already activated on a different device
    if (license.deviceId && license.deviceId !== license.device?.id) {
      throw new Error('License is already activated on another device');
    }

    // Create or update device
    const device = await this.prisma.device.upsert({
      where: { fingerprint: deviceFingerprint },
      update: { lastSeen: new Date() },
      create: {
        fingerprint: deviceFingerprint,
        ipAddress,
        userAgent,
        firstSeen: new Date(),
        lastSeen: new Date()
      }
    });

    // Update license with device
    const updatedLicense = await this.prisma.license.update({
      where: { id: license.id },
      data: {
        deviceId: device.id,
        status: LicenseStatus.ACTIVE,
        activationDate: new Date()
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

    const trialLicense = await this.createLicense(
      userId,
      trialPlan.id,
      undefined,
      new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days trial
    );

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

  /**
   * Generate device fingerprint from request data
   */
  static generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const data = `${userAgent}-${ipAddress}-${process.env.NODE_ENV || 'development'}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}