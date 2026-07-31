import { randomUUID } from "crypto";
import { Queue } from "bullmq";
import IORedis from "ioredis";

/** Bot tarafındaki OutboundJob tanımıyla senkron tutulmalı (apps/whatsapp-bot/src/index.ts) */
export type OutboundJob = {
  telefon: string;
  text: string;
  complaintId?: string;
  sentByUserId?: string;
  /** WhatsAppMessage satırıyla eşleşen idempotency anahtarı (BullMQ jobId) */
  outboundKey: string;
};

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForQueue = globalThis as unknown as {
  whatsappOutboundQueue?: Queue<OutboundJob>;
};

function getQueue(): Queue<OutboundJob> {
  if (!globalForQueue.whatsappOutboundQueue) {
    const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    globalForQueue.whatsappOutboundQueue = new Queue<OutboundJob>(
      "whatsapp-outbound",
      { connection },
    );
  }
  return globalForQueue.whatsappOutboundQueue;
}

export function yeniOutboundKey(): string {
  return randomUUID();
}

/**
 * Vatandaşa gönderilecek mesajı kuyruğa ekler. Bot bağlı değilse mesaj
 * kuyrukta bekler; bot ayağa kalkınca gönderilir (BullMQ retry/backoff).
 * jobId = outboundKey olduğu için aynı anahtar iki kez kuyruğa girmez.
 *
 * Deneme planı ~1,5 saati kapsar (10s'den katlanarak): bot kısa süreli
 * kopmalarda mesajı kaybetmez. Tüm denemeler tükenirse bot satırı
 * BASARISIZ işaretler ve operatör panelden yeniden gönderebilir.
 */
export async function whatsappMesajKuyrugaEkle(job: OutboundJob): Promise<void> {
  await getQueue().add("outbound", job, {
    jobId: job.outboundKey,
    attempts: 10,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  });
}
