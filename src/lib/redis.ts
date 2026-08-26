import Redis from "ioredis";

function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL gerekli");
  return url;
}

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl(), { maxRetriesPerRequest: null, lazyConnect: true });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
