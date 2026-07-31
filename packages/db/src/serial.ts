import { gorevNoUret, sikayetNoUret } from "@kars/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

function lockKey(kind: "complaint" | "task", yil: number): number {
  // 32-bit signed advisory lock key
  const base = kind === "complaint" ? 1_000_000 : 2_000_000;
  return base + (yil % 100_000);
}

async function advisoryLock(tx: Tx, key: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
}

export async function nextComplaintSerial(tx: Tx): Promise<{
  yil: number;
  sira: number;
  sikayetNo: string;
}> {
  const yil = new Date().getFullYear();
  await advisoryLock(tx, lockKey("complaint", yil));
  const son = await tx.complaint.findFirst({
    where: { yil },
    orderBy: { sira: "desc" },
    select: { sira: true },
  });
  const sira = (son?.sira ?? 0) + 1;
  return { yil, sira, sikayetNo: sikayetNoUret(yil, sira) };
}

export async function nextTaskSerial(tx: Tx): Promise<{
  yil: number;
  sira: number;
  gorevNo: string;
}> {
  const yil = new Date().getFullYear();
  await advisoryLock(tx, lockKey("task", yil));
  const son = await tx.vehicleTask.findFirst({
    where: { yil },
    orderBy: { sira: "desc" },
    select: { sira: true },
  });
  const sira = (son?.sira ?? 0) + 1;
  return { yil, sira, gorevNo: gorevNoUret(yil, sira) };
}

function hataKodu(err: unknown): string | null {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

export function isUniqueViolation(err: unknown): boolean {
  return hataKodu(err) === "P2002";
}

/**
 * Yeniden denenebilir hatalar:
 * P2002 sıra numarası çakışması, P2028 transaction başlatma/zaman aşımı
 * (advisory lock kuyruğu uzadığında), P2034 write conflict / deadlock.
 */
const YENIDEN_DENENEBILIR = new Set(["P2002", "P2028", "P2034"]);

function yenidenDenenebilirMi(err: unknown): boolean {
  const code = hataKodu(err);
  return code != null && YENIDEN_DENENEBILIR.has(code);
}

/**
 * Sıra numarası üreten create'ler için transaction sarmalayıcı.
 * Sıra numarası advisory lock ile seri üretildiği için eşzamanlı istekler
 * kuyruğa girer; kuyruk beklemesi varsayılan 2 sn'yi aşabildiği için
 * maxWait/timeout yükseltilir ve geçici hatalar artan bekleme ile denenir.
 */
export async function withSerialRetry<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      return await prisma.$transaction(fn, { maxWait: 8_000, timeout: 20_000 });
    } catch (err) {
      last = err;
      if (!yenidenDenenebilirMi(err) || i === maxAttempts - 1) throw err;
      const bekle = 50 * 2 ** i + Math.floor(Math.random() * 50);
      await new Promise((resolve) => setTimeout(resolve, bekle));
    }
  }
  throw last;
}
