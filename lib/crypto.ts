import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt);
  return `${salt}:${hash.toString("hex")}`;
}

async function scryptAsync(password: string, salt: string) {
  return new Promise<Buffer<ArrayBuffer>>((resolved, rejected) => {
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return rejected(err);
      resolved(derivedKey);
    });
  });
}

export async function verifyPassword(password: string, storedhash: string) {
  const [salt, hashhex] = storedhash.split(":");
  const stored = Buffer.from(hashhex, "hex");
  const derivedKey = await scryptAsync(password, salt);
  return timingSafeEqual(stored, derivedKey);
}

export function generateApiKey() {
  const raw = randomBytes(32).toString("base64");
  const hash = hashApiKey(raw);
  const prefix = hash.slice(0, 8);
  return { raw, hash, prefix };
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}
