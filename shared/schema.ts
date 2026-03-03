import { pgTable, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("STAFF"), // OWNER, ADMIN, STAFF
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").$onUpdate(() => new Date()),
});

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  price: integer("price").notNull(), // in cents
  durationDays: integer("durationDays").notNull(),
  features: jsonb("features").default([]),
  description: text("description"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").$onUpdate(() => new Date()),
  ownerId: text("ownerId"),
  managerId: text("managerId"),
});

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  ownerName: text("ownerName"),
  ownerEmail: text("ownerEmail"),
  labRegion: text("labRegion"),
  fingerprint: text("fingerprint").notNull().unique(),
  diskId: text("diskId").unique(),
  motherboardId: text("motherboardId"),
  cpuId: text("cpuId"),
  macAddress: text("macAddress"),
  systemName: text("systemName"),
  osVersion: text("osVersion"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  firstSeen: timestamp("firstSeen").defaultNow(),
  lastSeen: timestamp("lastSeen").$onUpdate(() => new Date()),
  isActive: boolean("isActive").notNull().default(false),
});

export const licenses = pgTable("licenses", {
  id: text("id").primaryKey(),
  licenseKey: text("licenseKey").notNull().unique(),
  userId: text("userId").references(() => users.id),
  planId: text("planId").references(() => plans.id),
  deviceId: text("deviceId").references(() => devices.id),
  status: text("status").notNull().default("PENDING"), // PENDING, ACTIVE, EXPIRED, SUSPENDED
  expiresAt: timestamp("expiresAt"),
  transactionId: text("transactionId"),
  paymentMode: text("paymentMode"),
  paymentVerified: boolean("paymentVerified").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").$onUpdate(() => new Date()),
  signature: text("signature"), // RSA signature
  activationDate: timestamp("activationDate"),
  lastValidated: timestamp("lastValidated"),
});

export const activityLogs = pgTable("activity_logs", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => users.id),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow(),
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
