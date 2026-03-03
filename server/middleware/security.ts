import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { log } from '../index';

// Rate limiting configurations
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      log(`Rate limit exceeded for ${req.ip}: ${req.path}`, 'security');
      res.status(429).json({
        error: 'Too many requests',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Strict rate limiting for authentication endpoints
export const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later.'
);

// General API rate limiting
export const apiRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many API requests, please try again later.'
);

// License activation rate limiting (more strict)
export const licenseRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // limit each IP to 3 license activations per hour
  'Too many license activation attempts, please try again later.'
);

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS configuration
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

export const corsMiddleware = cors(corsOptions);

// HTTPS enforcement middleware
export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
  }
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };
    
    log(JSON.stringify(logData), 'request');
  });
  
  next();
};

// IP blocking middleware
const blockedIPs = new Set<string>();

export const blockIP = (ip: string) => {
  blockedIPs.add(ip);
  log(`Blocked IP: ${ip}`, 'security');
};

export const unblockIP = (ip: string) => {
  blockedIPs.delete(ip);
  log(`Unblocked IP: ${ip}`, 'security');
};

export const ipBlocker = (req: Request, res: Response, next: NextFunction) => {
  if (blockedIPs.has(req.ip)) {
    log(`Blocked IP attempted access: ${req.ip}`, 'security');
    return res.status(403).json({ error: 'Access forbidden' });
  }
  next();
};

// Request size limiting
export const requestSizeLimit = express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
});

// Activity logging middleware
export const activityLogger = async (req: Request, res: Response, next: NextFunction) => {
  // Skip logging for health checks and static assets
  if (req.path === '/health' || req.path.startsWith('/static/')) {
    return next();
  }

  // Log sensitive operations
  const sensitivePaths = ['/api/login', '/api/licenses', '/api/users', '/api/plans'];
  const isSensitive = sensitivePaths.some(path => req.path.includes(path));

  if (isSensitive) {
    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path,
      body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
      userId: (req as any).user?.id
    };

    log(`Sensitive operation: ${JSON.stringify(logData)}`, 'activity');
  }

  next();
};

// Device fingerprint validation
export const validateDeviceFingerprint = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip;
  
  if (!userAgent || !ipAddress) {
    return res.status(400).json({ error: 'Missing device information' });
  }

  // Store device info in request for later use
  (req as any).deviceInfo = {
    userAgent,
    ipAddress,
    fingerprint: `${userAgent}-${ipAddress}`
  };

  next();
};

// Role-based access control
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(user.role)) {
      log(`Unauthorized access attempt by ${user.username} (${user.role}) to ${req.path}`, 'security');
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Security audit middleware
export const securityAudit = (req: Request, res: Response, next: NextFunction) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\./, // Directory traversal
    /<script/i, // XSS attempts
    /union\s+select/i, // SQL injection
    /drop\s+table/i, // SQL injection
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const hasSuspiciousContent = checkValue(req.body) || 
                             checkValue(req.query) || 
                             checkValue(req.params);

  if (hasSuspiciousContent) {
    log(`Suspicious content detected from ${req.ip}: ${req.path}`, 'security');
    return res.status(400).json({ error: 'Invalid request content' });
  }

  next();
};

// Export all middleware
export const securityMiddleware = [
  securityHeaders,
  corsMiddleware,
  enforceHttps,
  requestLogger,
  ipBlocker,
  requestSizeLimit,
  activityLogger,
  validateDeviceFingerprint,
  securityAudit
];