import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import { 
  authRateLimit, 
  apiRateLimit, 
  licenseRateLimit,
  securityMiddleware,
  requireRole,
  blockIP,
  unblockIP
} from "./middleware/security";
import { LicenseService } from "./services/license-service";
import { emailService } from "./services/email-service";
import { LicenseStatus, PrismaClient } from "@prisma/client";
import { allowedOrigins, jwtSecret } from "./config/env";

const JWT_SECRET = jwtSecret();
const prisma = new PrismaClient();
const licenseService = new LicenseService(prisma);

export function setupAuth(app: Express) {
  app.use(cookieParser());
}

export function authenticateToken(req: any, res: any, next: any) {
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(401).json({ message: "Unauthorized" });
    req.user = user;
    next();
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const sanitizeLicenseForDesktop = (license: any) => {
    if (!license || typeof license !== "object") return license;
    const { signature, ...rest } = license;
    return rest;
  };

  const sanitizeValidationResultForDesktop = (result: any) => {
    if (!result || typeof result !== "object") return result;
    return {
      ...result,
      license: sanitizeLicenseForDesktop(result.license),
    };
  };
  const resolveDeviceCustomerEmail = (email: string | null | undefined) => {
    const value = email?.trim();
    return value && value.includes("@") ? value : null;
  };

  // Configure CORS for Netlify
  app.use(cors({
    origin: allowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Apply security middleware
  app.use(securityMiddleware);
  
  setupAuth(app);
  
  // Auth routes with rate limiting
  app.post(api.auth.login.path, authRateLimit, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      });
      
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: "Logged out" });
  });

  app.get(api.auth.me.path, authenticateToken, async (req: any, res) => {
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
  });

  // Admin routes with role-based access control
  app.get(api.users.list.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    const users = await storage.getUsers();
    res.status(200).json(users.map(u => {
      const { password, ...rest } = u;
      return rest;
    }));
  });

  app.post(api.users.create.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const input = api.users.create.input.parse(req.body);

      const existingByUsername = await storage.getUserByUsername(input.username);
      if (existingByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingByEmail = await storage.getUserByEmail(input.email);
      if (existingByEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser({
        ...input,
        role: String(input.role || "STAFF").toUpperCase(),
        password: hashedPassword
      });
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.users.update.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const { id } = req.params;
      const input = api.users.update.input.parse(req.body);

      const updates: any = { ...input };
      if (typeof input.username === "string" && input.username.trim()) {
        const existingByUsername = await storage.getUserByUsername(input.username.trim());
        if (existingByUsername && existingByUsername.id !== id) {
          return res.status(400).json({ message: "Username already exists" });
        }
        updates.username = input.username.trim();
      }

      if (typeof input.email === "string" && input.email.trim()) {
        const existingByEmail = await storage.getUserByEmail(input.email.trim());
        if (existingByEmail && existingByEmail.id !== id) {
          return res.status(400).json({ message: "Email already exists" });
        }
        updates.email = input.email.trim();
      }

      if (typeof input.role === "string" && input.role.trim()) {
        updates.role = input.role.toUpperCase();
      }

      if (typeof input.password === "string" && input.password.trim()) {
        updates.password = await bcrypt.hash(input.password, 10);
      } else {
        delete updates.password;
      }

      const updated = await storage.updateUser(String(id), updates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: "Update User",
        details: `Updated user ${updated.username}`
      });

      const { password: _, ...userWithoutPassword } = updated;
      res.status(200).json(userWithoutPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  // License management routes
  app.get(api.licenses.list.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    await licenseService.expireDueLicenses();
    const licenses = await storage.getLicenses();
    res.status(200).json(licenses);
  });

  app.post(api.licenses.create.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const {
        userId,
        planId,
        deviceId,
        deviceFingerprint,
        status,
        transactionId,
        paymentMode,
        paymentVerified
      } = req.body;
      
      const mappedStatus = typeof status === "string"
        ? LicenseStatus[status.toUpperCase() as keyof typeof LicenseStatus]
        : undefined;

      const license = await licenseService.createLicense({
        userId,
        planId,
        deviceId,
        deviceFingerprint,
        status: mappedStatus,
        transactionId,
        paymentMode,
        paymentVerified: typeof paymentVerified === "boolean" ? paymentVerified : false
      });
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "Create License",
        details: `Created license ${license.licenseKey} for user ${userId}`
      });

      const recipientEmail = resolveDeviceCustomerEmail(license.device?.ownerEmail);
      if (recipientEmail) {
        try {
          await emailService.sendLicenseDeliveryEmail({
            toEmail: recipientEmail,
            ownerName: license.device?.ownerName,
            licenseKey: license.licenseKey,
            planName: license.plan?.name,
            expiresAt: license.expiresAt,
            appName: "LicenseOps"
          });
        } catch (emailErr: any) {
          await storage.createActivityLog({
            userId: req.user.id,
            action: "License Email Failed",
            details: `License ${license.licenseKey} email failed: ${emailErr?.message || "Unknown error"}`
          });
        }
      } else {
        await storage.createActivityLog({
          userId: req.user.id,
          action: "License Email Skipped",
          details: `License ${license.licenseKey} email skipped: device owner email missing`
        });
      }
      
      res.status(201).json(license);
    } catch(err: any) {
      res.status(400).json({ message: err.message || "Internal error" });
    }
  });

  app.put(api.licenses.update.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const { id } = req.params;
      const input = api.licenses.update.input.parse(req.body);
      const normalized = {
        ...input,
        ...(typeof input.status === "string" ? { status: input.status.toUpperCase() } : {})
      };
      const updated = await storage.updateLicense(id, normalized);
      if (!updated) {
        return res.status(404).json({ message: "License not found" });
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: "Update License",
        details: `Updated license ${updated.licenseKey}`
      });

      res.status(200).json(updated);
    } catch(err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.licenses.delete.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const { id } = req.params;
      const license = await storage.getLicense(id);
      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }

      await storage.deleteLicense(id);
      await storage.createActivityLog({
        userId: req.user.id,
        action: "Delete License",
        details: `Deleted license ${license.licenseKey}`
      });
      res.status(204).send();
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post(api.licenses.sendEmail.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const { id } = req.params;
      const license = await prisma.license.findUnique({
        where: { id },
        include: {
          user: true,
          plan: true,
          device: true
        }
      });

      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }

      const recipientEmail = resolveDeviceCustomerEmail(license.device?.ownerEmail);
      if (!recipientEmail) {
        return res.status(400).json({ message: "Device owner email is missing for this license" });
      }

      await emailService.sendLicenseDeliveryEmail({
        toEmail: recipientEmail,
        ownerName: license.device?.ownerName,
        licenseKey: license.licenseKey,
        planName: license.plan?.name,
        expiresAt: license.expiresAt,
        appName: "LicenseOps"
      });

      await storage.createActivityLog({
        userId: req.user.id,
        action: "License Email Sent",
        details: `Sent license ${license.licenseKey} to ${recipientEmail}`
      });

      res.status(200).json({ message: "License email sent successfully" });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to send license email" });
    }
  });

  // License validation endpoint (for desktop apps)
  app.post('/api/licenses/validate', licenseRateLimit, async (req, res) => {
    try {
      const { licenseKey, deviceFingerprint } = req.body;
      const { ipAddress = "", userAgent = "" } = req.deviceInfo ?? {};
      
      const result = await licenseService.validateLicense(
        licenseKey,
        deviceFingerprint,
        ipAddress,
        userAgent
      );
      
      res.status(200).json(sanitizeValidationResultForDesktop(result));
    } catch(err: any) {
      res.status(400).json({ valid: false, message: err.message });
    }
  });

  // License activation endpoint
  app.post('/api/licenses/activate', licenseRateLimit, async (req, res) => {
    try {
      const { licenseKey, deviceFingerprint } = req.body;
      const { ipAddress = "", userAgent = "" } = req.deviceInfo ?? {};
      
      const license = await licenseService.activateLicense(
        licenseKey,
        deviceFingerprint,
        ipAddress,
        userAgent
      );
      
      res.status(200).json(sanitizeLicenseForDesktop(license));
    } catch(err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post('/api/activate', licenseRateLimit, async (req, res) => {
    try {
      const { licenseKey, deviceFingerprint } = req.body;
      const { ipAddress = "", userAgent = "" } = req.deviceInfo ?? {};
      const license = await licenseService.activateLicense(licenseKey, deviceFingerprint, ipAddress, userAgent);
      res.status(200).json(sanitizeLicenseForDesktop(license));
    } catch(err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post('/api/validate', licenseRateLimit, async (req, res) => {
    try {
      const { licenseKey, deviceFingerprint } = req.body;
      const { ipAddress = "", userAgent = "" } = req.deviceInfo ?? {};
      const result = await licenseService.validateLicense(licenseKey, deviceFingerprint, ipAddress, userAgent);
      res.status(200).json(sanitizeValidationResultForDesktop(result));
    } catch(err: any) {
      res.status(400).json({ valid: false, message: err.message });
    }
  });

  // Trial license endpoint
  app.post('/api/licenses/trial', licenseRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      const { ipAddress = "" } = req.deviceInfo ?? {};
      
      // Check trial eligibility
      const eligible = await licenseService.checkTrialEligibility(email, ipAddress);
      if (!eligible) {
        return res.status(400).json({ message: "Trial not available for this email or IP address" });
      }
      
      // Create user if doesn't exist
      let user = await storage.getUserByEmail(email);
      if (!user) {
        const hashedPassword = await bcrypt.hash(Math.random().toString(36).substring(2, 15), 10);
        user = await storage.createUser({
          username: email.split('@')[0],
          email,
          password: hashedPassword,
          role: 'STAFF'
        });
      }
      
      const licenseKey = await licenseService.createTrialLicense(user.id, ipAddress);
      
      res.status(201).json({ licenseKey, message: "Trial license created successfully" });
    } catch(err: any) {
      res.status(500).json({ message: err.message || "Internal error" });
    }
  });

  // Plans
  app.get(api.plans.list.path, authenticateToken, apiRateLimit, async (req, res) => {
    const plans = await storage.getPlans();
    res.status(200).json(plans);
  });

  app.post(api.plans.create.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      const input = api.plans.create.input.parse(req.body);
      const plan = await storage.createPlan(input);
      res.status(201).json(plan);
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.plans.update.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      const { id } = req.params;
      const input = api.plans.update.input.parse(req.body);
      const plan = await storage.updatePlan(String(id), input);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      res.status(200).json(plan);
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.plans.delete.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePlan(String(id));
      res.status(204).send();
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Devices
  app.post(api.devices.register.path, apiRateLimit, async (req, res) => {
    try {
      const payload = api.devices.register.input.parse(req.body);
      const existingByDisk = payload.diskId ? await storage.getDeviceByDiskId(payload.diskId) : undefined;
      const existingByFingerprint = await storage.getDeviceByFingerprint(payload.fingerprint);
      const existing = existingByDisk ?? existingByFingerprint;

      if (existing) {
        const updated = await storage.updateDevice(existing.id, {
          ownerName: payload.ownerName ?? existing.ownerName,
          ownerEmail: payload.ownerEmail ?? existing.ownerEmail,
          labRegion: payload.labRegion ?? existing.labRegion,
          diskId: payload.diskId ?? existing.diskId,
          motherboardId: payload.motherboardId ?? existing.motherboardId,
          cpuId: payload.cpuId ?? existing.cpuId,
          macAddress: payload.macAddress ?? existing.macAddress,
          systemName: payload.systemName ?? existing.systemName,
          osVersion: payload.osVersion ?? existing.osVersion,
          ipAddress: req.deviceInfo?.ipAddress ?? existing.ipAddress,
          userAgent: req.deviceInfo?.userAgent ?? existing.userAgent,
          fingerprint: payload.fingerprint
        });
        return res.status(200).json(updated);
      }

      const created = await storage.createDevice({
        ...payload,
        ipAddress: req.deviceInfo?.ipAddress,
        userAgent: req.deviceInfo?.userAgent
      });

      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.devices.list.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    const devices = await storage.getDevices();
    res.status(200).json(devices);
  });

  app.put(api.devices.update.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const { id } = req.params;
      const input = api.devices.update.input.parse(req.body);
      const device = await storage.updateDevice(id, input);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: "Update Device",
        details: `Updated device ${device.id}`
      });

      res.status(200).json(device);
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      res.status(500).json({ message: "Internal error" });
    }
  });


  app.delete(api.devices.delete.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const { id } = req.params;
      const device = await storage.getDevice(String(id));
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      await prisma.license.updateMany({
        where: { deviceId: String(id) },
        data: { deviceId: null, status: LicenseStatus.PENDING }
      });

      await storage.deleteDevice(String(id));
      await storage.createActivityLog({
        userId: req.user.id,
        action: "Delete Device",
        details: `Deleted device ${device.id}`
      });

      res.status(204).send();
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });
  // Activity Logs
  app.get(api.activityLogs.list.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    const logs = await storage.getActivityLogs();
    res.status(200).json(logs);
  });

  // License statistics endpoint
  app.get('/api/licenses/stats', authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      await licenseService.expireDueLicenses();
      const stats = await licenseService.getLicenseStats();
      res.status(200).json(stats);
    } catch(err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Security management endpoints
  app.post('/api/security/block-ip', authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      const { ip } = z.object({ ip: z.string().min(1) }).parse(req.body);
      blockIP(ip);
      res.status(200).json({ message: `IP ${ip} blocked successfully` });
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post('/api/security/unblock-ip', authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      const { ip } = z.object({ ip: z.string().min(1) }).parse(req.body);
      unblockIP(ip);
      res.status(200).json({ message: `IP ${ip} unblocked successfully` });
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Initial seeding of basic db logic if users array is empty
  const allUsers = await storage.getUsers();
  if (allUsers.length === 0) {
    const hashedPassword = await bcrypt.hash('admin', 10);
    const adminUser = await storage.createUser({
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'OWNER'
    });
    
    // Seed a basic plan
    const plan = await storage.createPlan({
      name: "Enterprise Pro",
      price: 9900,
      durationDays: 365,
      features: ["All Features", "24/7 Support"],
      description: "Premium enterprise plan with all features"
    });
    
    // Seed an initial license
    await storage.createLicense({
      licenseKey: "LIC-ENTERPRISE-Q1",
      planId: plan.id,
      userId: adminUser.id,
      status: "ACTIVE"
    });
    
    await storage.createActivityLog({
      userId: adminUser.id,
      action: "System Initialization",
      details: "Created initial admin user, plan and license."
    });
  }

  return httpServer;
}


