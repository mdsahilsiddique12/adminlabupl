import { z } from 'zod';
import { 
  insertUserSchema, users,
  insertPlanSchema, plans,
  insertLicenseSchema, licenses,
  insertDeviceSchema, devices,
  insertActivityLogSchema, activityLogs
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login' as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout' as const,
      responses: { 200: z.object({ message: z.string() }) }
    },
    me: {
      method: 'GET' as const,
      path: '/api/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  plans: {
    list: {
      method: 'GET' as const,
      path: '/api/plans' as const,
      responses: { 200: z.array(z.custom<typeof plans.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/plans' as const,
      input: insertPlanSchema,
      responses: { 201: z.custom<typeof plans.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/plans/:id' as const,
      input: insertPlanSchema.partial(),
      responses: { 200: z.custom<typeof plans.$inferSelect>(), 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/plans/:id' as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound }
    }
  },
  licenses: {
    list: {
      method: 'GET' as const,
      path: '/api/licenses' as const,
      responses: { 200: z.array(z.custom<typeof licenses.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/licenses' as const,
      input: insertLicenseSchema,
      responses: { 201: z.custom<typeof licenses.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/licenses/:id' as const,
      input: insertLicenseSchema.partial(),
      responses: { 200: z.custom<typeof licenses.$inferSelect>(), 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/licenses/:id' as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound }
    }
  },
  devices: {
    register: {
      method: 'POST' as const,
      path: '/api/devices/register' as const,
      input: insertDeviceSchema.extend({
        fingerprint: z.string().min(1),
      }),
      responses: { 201: z.custom<typeof devices.$inferSelect>(), 200: z.custom<typeof devices.$inferSelect>(), 400: errorSchemas.validation }
    },
    list: {
      method: 'GET' as const,
      path: '/api/devices' as const,
      responses: { 200: z.array(z.custom<typeof devices.$inferSelect>()) }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/devices/:id' as const,
      input: insertDeviceSchema.partial().extend({
        isActive: z.boolean().optional(),
      }),
      responses: { 200: z.custom<typeof devices.$inferSelect>(), 404: errorSchemas.notFound }
    }
  },
  activityLogs: {
    list: {
      method: 'GET' as const,
      path: '/api/activity-logs' as const,
      responses: { 200: z.array(z.custom<typeof activityLogs.$inferSelect>()) }
    }
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users' as const,
      responses: { 200: z.array(z.custom<typeof users.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/users' as const,
      input: insertUserSchema,
      responses: { 201: z.custom<typeof users.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/users/:id' as const,
      input: insertUserSchema.partial(),
      responses: { 200: z.custom<typeof users.$inferSelect>(), 404: errorSchemas.notFound }
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
