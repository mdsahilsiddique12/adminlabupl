import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import cors from "cors";
import { 
  authRateLimit, 
  apiRateLimit, 
  licenseRateLimit,
  securityMiddleware,
  authenticateToken,
  requireRole,
  blockIP,
  unblockIP
} from "./middleware/security";
import { LicenseService } from "./services/license-service";
import { PrismaClient } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-for-jwt-keep-it-safe";
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
  // Configure CORS for Netlify
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
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
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      
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
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", field: err.errors[0]?.path.join('.') });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // License management routes
  app.get(api.licenses.list.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    const licenses = await storage.getLicenses();
    res.status(200).json(licenses);
  });

  app.post(api.licenses.create.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req: any, res) => {
    try {
      const { userId, planId, deviceFingerprint, expiresAt } = req.body;
      
      const license = await licenseService.createLicense(
        userId,
        planId,
        deviceFingerprint,
        expiresAt ? new Date(expiresAt) : undefined
      );
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "Create License",
        details: `Created license ${license.licenseKey} for user ${userId}`
      });
      
      res.status(201).json(license);
    } catch(err: any) {
      res.status(500).json({ message: err.message || "Internal error" });
    }
  });

  // License validation endpoint (for desktop apps)
  app.post('/api/licenses/validate', licenseRateLimit, async (req, res) => {
    try {
      const { licenseKey, deviceFingerprint } = req.body;
      const { ipAddress, userAgent } = req.deviceInfo;
      
      const result = await licenseService.validateLicense(
        licenseKey,
        deviceFingerprint,
        ipAddress,
        userAgent
      );
      
      res.status(200).json(result);
    } catch(err: any) {
      res.status(400).json({ valid: false, message: err.message });
    }
  });

  // License activation endpoint
  app.post('/api/licenses/activate', licenseRateLimit, async (req, res) => {
    try {
      const { licenseKey, deviceFingerprint } = req.body;
      const { ipAddress, userAgent } = req.deviceInfo;
      
      const license = await licenseService.activateLicense(
        licenseKey,
        deviceFingerprint,
        ipAddress,
        userAgent
      );
      
      res.status(200).json(license);
    } catch(err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Trial license endpoint
  app.post('/api/licenses/trial', licenseRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      const { ipAddress } = req.deviceInfo;
      
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
          role: 'staff'
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

  // Devices
  app.get(api.devices.list.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    const devices = await storage.getDevices();
    res.status(200).json(devices);
  });

  // Activity Logs
  app.get(api.activityLogs.list.path, authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    const logs = await storage.getActivityLogs();
    res.status(200).json(logs);
  });

  // License statistics endpoint
  app.get('/api/licenses/stats', authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      const stats = await licenseService.getLicenseStats();
      res.status(200).json(stats);
    } catch(err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Security management endpoints
  app.post('/api/security/block-ip', authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      const { ip } = req.body;
      blockIP(ip);
      res.status(200).json({ message: `IP ${ip} blocked successfully` });
    } catch(err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post('/api/security/unblock-ip', authenticateToken, requireRole(['owner', 'admin']), apiRateLimit, async (req, res) => {
    try {
      const { ip } = req.body;
      unblockIP(ip);
      res.status(200).json({ message: `IP ${ip} unblocked successfully` });
    } catch(err) {
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
      role: 'owner'
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
      status: "active"
    });
    
    await storage.createActivityLog({
      userId: adminUser.id,
      action: "System Initialization",
      details: "Created initial admin user, plan and license."
    });
  }

  return httpServer;
}
