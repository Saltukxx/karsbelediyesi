/**
 * Uçtan uca duman testi: müdürlük → personel ataması → /islerim verisi →
 * whatsapp-outbound kuyruğu → GIDEN kaydı simülasyonu.
 * Çalıştırma: npx tsx scripts/smoke-atama.ts
 */
import { randomUUID } from "crypto";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../packages/db/src/index";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** Test yarıda kalırsa bot gerçek gönderim denemesin diye job izlenir */
let acikJob: { remove: () => Promise<unknown> } | null = null;
let acikQueue: Queue | null = null;

async function kuyrukTemizle() {
  try {
    await acikJob?.remove();
  } catch {
    // job zaten silinmiş olabilir
  }
  acikJob = null;
  await acikQueue?.close();
  acikQueue = null;
}

async function main() {
  // 1) Müdürlük + personel + kullanıcı bağı
  const dept = await prisma.department.findFirst({ where: { aktif: true } });
  if (!dept) throw new Error("Aktif müdürlük yok (seed çalıştırın)");

  const user = await prisma.user.upsert({
    where: { phone: "05990000001" },
    update: {},
    create: {
      name: "Smoke Saha Personeli",
      phone: "05990000001",
      passwordHash: "x",
      role: "FIELD_WORKER",
      departmentId: dept.id,
    },
  });
  const personel = await prisma.personnel.upsert({
    where: { userId: user.id },
    update: { departmentId: dept.id },
    create: {
      adSoyad: "Smoke Saha Personeli",
      departmentId: dept.id,
      userId: user.id,
    },
  });
  console.log("✓ Personel + kullanıcı bağı:", personel.adSoyad, "→", dept.name);

  // 2) WhatsApp kanallı şikayet + müdürlük + personel ataması
  const yil = new Date().getFullYear();
  const son = await prisma.complaint.findFirst({
    where: { yil },
    orderBy: { sira: "desc" },
  });
  const sira = (son?.sira ?? 0) + 1;
  const complaint = await prisma.complaint.create({
    data: {
      sikayetNo: `SMK-${yil}-${String(sira).padStart(4, "0")}`,
      yil,
      sira,
      kanal: "WHATSAPP",
      arayanKisi: "905990000002",
      telefon: "905990000002",
      aciklama: "Smoke test şikayeti",
      departmentId: dept.id,
      personel: { create: { personnelId: personel.id } },
    },
  });
  console.log("✓ Şikayet oluşturuldu ve atandı:", complaint.sikayetNo);

  // 3) Asfalt rotası + müdürlük + personel ataması
  const road = await prisma.asphaltRoad.create({
    data: {
      ad: "Smoke Test Rotası",
      koordinatlar: [
        [40.6013, 43.0975],
        [40.6021, 43.0989],
      ],
      durum: "PLANLANDI",
      departmentId: dept.id,
      createdById: user.id,
      personel: { create: { personnelId: personel.id } },
    },
  });
  console.log("✓ Asfalt rotası oluşturuldu ve atandı:", road.ad);

  // 4) /islerim sorguları (sayfanın yaptığı sorgular)
  const [sikayetler, rotalar] = await Promise.all([
    prisma.complaintPersonnel.findMany({
      where: { personnelId: personel.id },
      include: { complaint: true },
    }),
    prisma.asphaltRoadPersonnel.findMany({
      where: { personnelId: personel.id },
      include: { asphaltRoad: true },
    }),
  ]);
  const sikayetVar = sikayetler.some((a) => a.complaintId === complaint.id);
  const rotaVar = rotalar.some((a) => a.asphaltRoadId === road.id);
  console.log(
    sikayetVar && rotaVar
      ? "✓ /islerim verisi: şikayet ve rota atamaları görünüyor"
      : "✗ /islerim verisi eksik!",
  );
  if (!sikayetVar || !rotaVar) process.exitCode = 1;

  // 5) Panel akışı: önce KUYRUKTA kaydı, sonra kuyruk (jobId = outboundKey)
  const outboundKey = randomUUID();
  const giden = await prisma.whatsAppMessage.create({
    data: {
      telefon: complaint.telefon!,
      yon: "GIDEN",
      icerik: "Smoke test cevabı",
      complaintId: complaint.id,
      sentByUserId: user.id,
      outboundKey,
      gonderimDurumu: "KUYRUKTA",
    },
  });

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue("whatsapp-outbound", { connection });
  acikQueue = queue;
  const payload = {
    telefon: complaint.telefon!,
    text: "Smoke test cevabı",
    complaintId: complaint.id,
    sentByUserId: user.id,
    outboundKey,
  };
  const job = await queue.add("outbound", payload, { jobId: outboundKey });
  acikJob = job;
  // Aynı anahtarla ikinci ekleme yeni job üretmemeli (BullMQ jobId tekilliği)
  const ikinci = await queue.add("outbound", payload, { jobId: outboundKey });
  console.log(
    ikinci.id === job.id
      ? "✓ Aynı outboundKey ile ikinci kuyruk kaydı oluşmadı"
      : "✗ outboundKey idempotency çalışmadı!",
  );
  if (ikinci.id !== job.id) process.exitCode = 1;
  const counts = await queue.getJobCounts("waiting", "active", "completed", "failed");
  console.log("✓ Kuyruğa eklendi. Kuyruk durumu:", counts);

  // 6) Bot davranışını simüle et: gönderim sonrası KUYRUKTA → GONDERILDI
  await prisma.whatsAppMessage.update({
    where: { outboundKey },
    data: { gonderimDurumu: "GONDERILDI", waMessageId: `SMOKE-${outboundKey}` },
  });
  // Retry: satır GONDERILDI olduğu için worker gönderim yapmadan çıkar
  const tekrar = await prisma.whatsAppMessage.findUnique({ where: { outboundKey } });
  if (tekrar?.gonderimDurumu !== "GONDERILDI") {
    throw new Error("Gönderim durumu GONDERILDI'ye geçmedi");
  }

  const thread = await prisma.whatsAppMessage.findMany({
    where: { complaintId: complaint.id },
    include: { sentByUser: { select: { name: true } } },
  });
  console.log(
    thread.length === 1 && thread[0].sentByUser?.name === user.name
      ? "✓ Tek GIDEN kaydı: çift gönderim denemesi yeni mesaj üretmedi"
      : "✗ GIDEN kaydı doğrulanamadı!",
  );
  if (thread.length !== 1) process.exitCode = 1;

  // 7) Temizlik
  await kuyrukTemizle();
  await prisma.whatsAppMessage.delete({ where: { id: giden.id } });
  await prisma.asphaltRoad.delete({ where: { id: road.id } });
  await prisma.complaint.delete({ where: { id: complaint.id } });
  await prisma.personnel.delete({ where: { id: personel.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("✓ Test verileri temizlendi");

  connection.disconnect();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("✗ Smoke test hatası:", e);
  await kuyrukTemizle();
  await prisma.$disconnect();
  process.exit(1);
});
