import { DomainError } from "./errors";
import { redis } from "./redis";

async function ensureRedis() {
  if (redis.status === "wait") await redis.connect();
}

export async function withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  await ensureRedis();
  const token = `${Date.now()}-${Math.random()}`;
  const ok = await redis.set(key, token, "EX", ttlSec, "NX");
  if (ok !== "OK") {
    throw new DomainError("Bu islem zaten suruyor. Biraz bekleyin.");
  }
  try {
    return await fn();
  } finally {
    const current = await redis.get(key);
    if (current === token) await redis.del(key);
  }
}

export async function rateLimit(key: string, ttlSec: number): Promise<boolean> {
  await ensureRedis();
  const ok = await redis.set(key, "1", "EX", ttlSec, "NX");
  return ok === "OK";
}
