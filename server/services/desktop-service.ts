import { PrismaClient } from '@prisma/client';
import { rsaKeyManager } from '../utils/rsa-keys';
import crypto from 'crypto';

interface DesktopLicenseData {
  licenseKey: string;
  userId: string;
  planId: string;
  expiresAt: Date;
  deviceFingerprint: string;
  activationDate: Date;
}

interface OfflineValidationRequest {
  licenseKey: string;
  deviceFingerprint: string;
  timestamp: number;
  signature: string;
}

interface OfflineValidationResponse {
  valid: boolean;
  license?: any;
  plan?: any;
  expiresAt?: Date;
  message: string;
  timestamp: number;
}

export class DesktopService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate offline validation package for desktop app
   */
  async generateOfflinePackage(licenseKey: string): Promise<any> {
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        user: true,
        plan: true,
        device: true
      }
    });

    if (!license) {
      throw new Error('License not found');
    }

    if (license.status !== 'active') {
      throw new Error(`License is ${license.status}`);
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      throw new Error('License has expired');
    }

    // Create offline validation data
    const offlineData = {
      licenseKey: license.licenseKey,
      userId: license.userId,
      planId: license.planId,
      expiresAt: license.expiresAt,
      deviceFingerprint: license.device?.fingerprint,
      activationDate: license.activationDate,
      timestamp: Date.now()
    };

    // Sign the offline data
    const signature = this.signOfflineData(offlineData);

    return {
      license,
      offlineData,
      signature,
      publicKey: rsaKeyManager.getPublicKey()
    };
  }

  /**
   * Validate license offline (for desktop apps)
   */
  validateOfflineLicense(request: OfflineValidationRequest): OfflineValidationResponse {
    try {
      // Verify timestamp is not too old (within 24 hours)
      const now = Date.now();
      if (Math.abs(now - request.timestamp) > 24 * 60 * 60 * 1000) {
        return {
          valid: false,
          message: 'Timestamp too old or too far in future',
          timestamp: now
        };
      }

      // Verify signature
      const dataToVerify = {
        licenseKey: request.licenseKey,
        deviceFingerprint: request.deviceFingerprint,
        timestamp: request.timestamp
      };

      const dataString = JSON.stringify(dataToVerify);
      const isValid = rsaKeyManager.verify(dataString, request.signature);

      if (!isValid) {
        return {
          valid: false,
          message: 'Invalid signature',
          timestamp: now
        };
      }

      // For offline validation, we trust the signed data
      // In a real implementation, you might want to implement additional checks
      // like checking against a local cache of revoked licenses

      return {
        valid: true,
        message: 'License validation successful',
        timestamp: now
      };

    } catch (error) {
      return {
        valid: false,
        message: 'Validation failed: ' + (error as Error).message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check for license updates (for desktop apps to sync with server)
   */
  async checkLicenseUpdates(licenseKey: string, lastSync: number): Promise<any> {
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        plan: true
      }
    });

    if (!license) {
      return { error: 'License not found' };
    }

    // Check if license was updated since last sync
    const licenseUpdated = license.updatedAt.getTime() > lastSync;
    const planUpdated = license.plan.updatedAt.getTime() > lastSync;

    return {
      licenseUpdated,
      planUpdated,
      license,
      plan: license.plan,
      timestamp: Date.now()
    };
  }

  /**
   * Handle license tampering detection
   */
  async reportTampering(licenseKey: string, deviceFingerprint: string, details: string): Promise<void> {
    // Log the tampering attempt
    await this.prisma.activityLog.create({
      data: {
        action: 'Tampering Detected',
        details: `License ${licenseKey} tampering attempt from device ${deviceFingerprint}: ${details}`,
        ipAddress: '',
        userAgent: ''
      }
    });

    // Optionally suspend the license
    await this.prisma.license.update({
      where: { licenseKey },
      data: { status: 'suspended' }
    });
  }

  /**
   * Generate device-specific license data for offline storage
   */
  async generateDeviceLicenseData(licenseKey: string, deviceFingerprint: string): Promise<any> {
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        user: true,
        plan: true
      }
    });

    if (!license) {
      throw new Error('License not found');
    }

    // Verify device matches
    if (license.device?.fingerprint !== deviceFingerprint) {
      throw new Error('License not activated for this device');
    }

    // Create device-specific license data
    const deviceData = {
      licenseKey: license.licenseKey,
      userId: license.userId,
      username: license.user.username,
      planName: license.plan.name,
      planFeatures: license.plan.features,
      expiresAt: license.expiresAt,
      activationDate: license.activationDate,
      deviceFingerprint,
      status: license.status,
      generatedAt: Date.now()
    };

    // Encrypt the device data (simple XOR encryption for demo)
    const encryptedData = this.encryptDeviceData(JSON.stringify(deviceData));

    return {
      encryptedData,
      checksum: this.calculateChecksum(deviceData),
      timestamp: Date.now()
    };
  }

  /**
   * Validate device license data
   */
  validateDeviceLicenseData(encryptedData: string, checksum: string): any {
    try {
      // Decrypt the data
      const decryptedData = JSON.parse(this.decryptDeviceData(encryptedData));

      // Verify checksum
      const calculatedChecksum = this.calculateChecksum(decryptedData);
      if (calculatedChecksum !== checksum) {
        throw new Error('Data integrity check failed');
      }

      // Check expiration
      if (decryptedData.expiresAt && new Date(decryptedData.expiresAt) < new Date()) {
        throw new Error('License has expired');
      }

      return {
        valid: true,
        data: decryptedData
      };

    } catch (error) {
      return {
        valid: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Sign offline data with RSA private key
   */
  private signOfflineData(data: any): string {
    const dataString = JSON.stringify(data);
    return rsaKeyManager.sign(dataString);
  }

  /**
   * Encrypt device data for secure offline storage
   */
  private encryptDeviceData(data: string): string {
    const key = process.env.DESKTOP_ENCRYPTION_KEY || 'default-key-change-in-production';
    let result = '';
    
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    
    return Buffer.from(result).toString('base64');
  }

  /**
   * Decrypt device data
   */
  private decryptDeviceData(encryptedData: string): string {
    const key = process.env.DESKTOP_ENCRYPTION_KEY || 'default-key-change-in-production';
    const data = Buffer.from(encryptedData, 'base64').toString();
    let result = '';
    
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    
    return result;
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: any): string {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Generate heartbeat for license validation
   */
  generateHeartbeat(licenseKey: string, deviceFingerprint: string): string {
    const heartbeatData = {
      licenseKey,
      deviceFingerprint,
      timestamp: Date.now(),
      nonce: Math.random().toString(36)
    };

    return rsaKeyManager.sign(JSON.stringify(heartbeatData));
  }

  /**
   * Validate heartbeat from desktop app
   */
  validateHeartbeat(licenseKey: string, deviceFingerprint: string, heartbeat: string): boolean {
    const heartbeatData = {
      licenseKey,
      deviceFingerprint,
      timestamp: Date.now(),
      nonce: Math.random().toString(36)
    };

    const dataString = JSON.stringify(heartbeatData);
    return rsaKeyManager.verify(dataString, heartbeat);
  }
}

// Export singleton instance
export const desktopService = new DesktopService(new PrismaClient());