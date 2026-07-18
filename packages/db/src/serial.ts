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

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

/** Transaction + P2002 retry for serial creates */
export async function withSerialRetry<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      return await prisma.$transaction(fn);
    } catch (err) {
      last = err;
      if (!isUniqueViolation(err) || i === maxAttempts - 1) throw err;
    }
  }
  throw last;
}
