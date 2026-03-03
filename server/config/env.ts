const splitAndClean = (raw: string) =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} environment variable is required.`);
  }
  return value.trim();
}

export function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || "";
  const values = splitAndClean(raw);
  if (values.length > 0) return values;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ALLOWED_ORIGINS is required in production.");
  }
  return ["http://localhost:5173", "http://localhost:3000"];
}

export function jwtSecret(): string {
  return requireEnv("JWT_SECRET");
}
