import { pgTable, text, varchar, timestamp, integer, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"), // owner, admin, staff
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  price: integer("price").notNull(), // in cents
  durationDays: integer("duration_days").notNull(),
  features: jsonb("features").default([]),
  description: text("description"),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  fingerprint: text("fingerprint").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastSeen: timestamp("last_seen").$onUpdate(() => new Date()),
  isActive: text("is_active").notNull().default("true"),
});

export const licenses = pgTable("licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseKey: text("license_key").notNull().unique(),
  userId: uuid("user_id").references(() => users.id),
  planId: uuid("plan_id").references(() => plans.id),
  deviceId: uuid("device_id").references(() => devices.id),
  status: text("status").notNull().default("active"), // active, expired, suspended, pending
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  signature: text("signature"), // RSA signature
  activationDate: timestamp("activation_date"),
  lastValidated: timestamp("last_validated"),
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  licenses: many(licenses),
  activityLogs: many(activityLogs),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  licenses: many(licenses),
}));

export const devicesRelations = relations(devices, ({ many }) => ({
  licenses: many(licenses),
}));

export const licensesRelations = relations(licenses, ({ one }) => ({
  user: one(users, { fields: [licenses.userId], references: [users.id] }),
  plan: one(plans, { fields: [licenses.planId], references: [plans.id] }),
  device: one(devices, { fields: [licenses.deviceId], references: [devices.id] }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanSchema = createInsertSchema(plans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true, firstSeen: true, lastSeen: true, isActive: true });
export const insertLicenseSchema = createInsertSchema(licenses).omit({ id: true, createdAt: true, updatedAt: true, activationDate: true, lastValidated: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export type License = typeof licenses.$inferSelect;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
