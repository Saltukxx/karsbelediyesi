import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForRedis = globalThis as unknown as {
  karsRedis?: IORedis | null;
};

/**
 * Paylaşılan ioredis istemcisi (rate-limit, dashboard önbelleği vb.).
 * Bağlantı kurulamazsa null döner; çağıranlar bellek/doğrudan DB yoluna düşer.
 */
export function getRedis(): IORedis | null {
  if (globalForRedis.karsRedis === undefined) {
    try {
      const istemci = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        // Bağlantı yokken komutlar kuyruğa alınmasın, hemen hata versin.
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: (deneme) => Math.min(deneme * 200, 5000),
      });
      // Dinleyici olmadan 'error' olayı süreci düşürür.
      istemci.on("error", () => {});
      globalForRedis.karsRedis = istemci;
    } catch {
      globalForRedis.karsRedis = null;
    }
  }
  return globalForRedis.karsRedis;
}
