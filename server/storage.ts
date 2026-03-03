import { db } from "./db";
import {
  users, plans, licenses, devices, activityLogs,
  type User, type InsertUser,
  type Plan, type InsertPlan,
  type License, type InsertLicense,
  type Device, type InsertDevice,
  type ActivityLog, type InsertActivityLog
} from "@shared/schema";
import crypto from "crypto";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Plans
  getPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, updates: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: string): Promise<void>;

  // Licenses
  getLicenses(): Promise<License[]>;
  getLicense(id: string): Promise<License | undefined>;
  getLicenseByKey(key: string): Promise<License | undefined>;
  createLicense(license: InsertLicense): Promise<License>;
  updateLicense(id: string, updates: Partial<InsertLicense>): Promise<License | undefined>;
  deleteLicense(id: string): Promise<void>;

  // Devices
  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  getDeviceByFingerprint(fingerprint: string): Promise<Device | undefined>;
  getDeviceByDiskId(diskId: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, updates: Partial<Device>): Promise<Device | undefined>;

  // Activity Logs
  getActivityLogs(): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({ id: crypto.randomUUID(), ...insertUser }).returning();
    return user;
  }
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getPlans(): Promise<Plan[]> {
    return await db.select().from(plans);
  }
  async getPlan(id: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan;
  }
  async createPlan(insertPlan: InsertPlan): Promise<Plan> {
    const [plan] = await db.insert(plans).values({ id: crypto.randomUUID(), ...insertPlan }).returning();
    return plan;
  }
  async updatePlan(id: string, updates: Partial<InsertPlan>): Promise<Plan | undefined> {
    const [plan] = await db.update(plans).set(updates).where(eq(plans.id, id)).returning();
    return plan;
  }
  async deletePlan(id: string): Promise<void> {
    await db.delete(plans).where(eq(plans.id, id));
  }

  async getLicenses(): Promise<License[]> {
    return await db.select().from(licenses);
  }
  async getLicense(id: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    return license;
  }
  async getLicenseByKey(key: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.licenseKey, key));
    return license;
  }
  async createLicense(insertLicense: InsertLicense): Promise<License> {
    const [license] = await db.insert(licenses).values({ id: crypto.randomUUID(), ...insertLicense }).returning();
    return license;
  }
  async updateLicense(id: string, updates: Partial<InsertLicense>): Promise<License | undefined> {
    const [license] = await db.update(licenses).set(updates).where(eq(licenses.id, id)).returning();
    return license;
  }
  async deleteLicense(id: string): Promise<void> {
    await db.delete(licenses).where(eq(licenses.id, id));
  }

  async getDevices(): Promise<Device[]> {
    return await db.select().from(devices);
  }
  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }
  async getDeviceByFingerprint(fingerprint: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.fingerprint, fingerprint));
    return device;
  }
  async getDeviceByDiskId(diskId: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.diskId, diskId));
    return device;
  }
  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const [device] = await db.insert(devices).values({ id: crypto.randomUUID(), ...insertDevice }).returning();
    return device;
  }
  async updateDevice(id: string, updates: Partial<Device>): Promise<Device | undefined> {
    const [device] = await db.update(devices).set(updates).where(eq(devices.id, id)).returning();
    return device;
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs);
  }
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [activityLog] = await db.insert(activityLogs).values({ id: crypto.randomUUID(), ...log }).returning();
    return activityLog;
  }
}

export const storage = new DatabaseStorage();
