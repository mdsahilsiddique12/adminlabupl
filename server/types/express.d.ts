import "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: unknown;
      deviceInfo?: {
        userAgent?: string;
        ipAddress?: string;
        fingerprint?: string;
      };
    }
  }
}

export {};
