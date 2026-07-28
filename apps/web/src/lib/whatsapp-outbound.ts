import { Queue } from "bullmq";
import IORedis from "ioredis";

/** Bot tarafındaki OutboundJob tanımıyla senkron tutulmalı (apps/whatsapp-bot/src/index.ts) */
export type OutboundJob = {
  telefon: string;
  text: string;
  complaintId?: string;
  sentByUserId?: string;
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

/**
 * Vatandaşa gönderilecek mesajı kuyruğa ekler. Bot bağlı değilse mesaj
 * kuyrukta bekler; bot ayağa kalkınca gönderilir (BullMQ retry/backoff).
 */
export async function whatsappMesajKuyrugaEkle(job: OutboundJob): Promise<void> {
  await getQueue().add("outbound", job, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  });
}
