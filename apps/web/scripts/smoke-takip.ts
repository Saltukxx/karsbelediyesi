/**
 * Rota takip analizi uçtan uca duman testi (sentetik veriyle):
 * temizlik rotası + dispatch görevi + sentetik GPS pingleri →
 * gorevIziAnalizEt → RouteTrackAnalysis doğrulaması → canlı sapma bildirimi.
 * Çalıştırma (apps/web içinden): npx tsx scripts/smoke-takip.ts
 * Test verisi sonda temizlenir.
 */
import { nextTaskSerial, prisma, withSerialRetry } from "@kars/db";
import { canliSapmaKontrol, gorevIziAnalizEt } from "../src/lib/route-analysis";

const LAT0 = 40.6013;
const LNG0 = 43.0975;
const M_LAT = 1 / 111200;
const M_LNG = 1 / (111200 * Math.cos((LAT0 * Math.PI) / 180));

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("ADMIN kullanıcı yok");
  const vehicle = await prisma.vehicle.findFirst({
    where: { envanterDurumu: { not: "HURDAYA_AYRILDI" } },
  });
  if (!vehicle) throw new Error("Araç yok");

  // 1) Temizlik rotası: batı→doğu 1 km düz hat
  const rota = await prisma.cleaningRoute.create({
    data: {
      ad: "SMOKE Takip Rotası",
      koordinatlar: [
        [LAT0, LNG0],
        [LAT0, LNG0 + 1000 * M_LNG],
      ],
      createdById: admin.id,
    },
  });
  console.log("✓ Temizlik rotası:", rota.ad);

  // 2) Dispatch job + görev
  const job = await prisma.dispatchJob.create({
    data: {
      tip: "TEMIZLIK",
      routeId: rota.id,
      routeAd: rota.ad,
      vehicleId: vehicle.id,
      durum: "ATANDI",
    },
  });
  const cikis = new Date(Date.now() - 60 * 60 * 1000);
  const task = await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, gorevNo } = await nextTaskSerial(tx);
    return tx.vehicleTask.create({
      data: {
        gorevNo,
        yil,
        sira,
        vehicleId: vehicle.id,
        gorevYeri: rota.ad,
        gorevTanimi: `Yol temizliği: ${rota.ad}`,
        cikisTarihi: cikis,
        durum: "DEVAM_EDIYOR",
        dispatchJobId: job.id,
      },
    });
  });
  console.log("✓ Görev:", task.gorevNo);

  // 3) Sentetik pingler (dakikada 1):
  //    0-9. dk rota boyunca, 10-14. dk 300 m kuzeye sapma,
  //    15-18. dk rotada 0 km/sa duraklama, 19-26. dk veri boşluğu,
  //    27-30. dk rota sonuna gidiş.
  type Ping = { dk: number; dogu: number; kuzey: number; hiz: number };
  const pingler: Ping[] = [];
  for (let i = 0; i <= 9; i++) pingler.push({ dk: i, dogu: i * 60, kuzey: 0, hiz: 25 });
  for (let i = 10; i <= 14; i++)
    pingler.push({ dk: i, dogu: 540 + (i - 9) * 20, kuzey: 300, hiz: 20 });
  for (let i = 15; i <= 18; i++)
    pingler.push({ dk: i, dogu: 660, kuzey: 0, hiz: 0 });
  // 19-26 boşluk
  for (let i = 27; i <= 30; i++)
    pingler.push({ dk: i, dogu: 660 + (i - 26) * 85, kuzey: 0, hiz: 25 });

  await prisma.vehicleLocation.createMany({
    data: pingler.map((p) => ({
      vehicleId: vehicle.id,
      lat: LAT0 + p.kuzey * M_LAT,
      lng: LNG0 + p.dogu * M_LNG,
      hiz: p.hiz,
      kaynak: "TELEFON" as const,
      zaman: new Date(cikis.getTime() + p.dk * 60000),
    })),
  });
  console.log(`✓ ${pingler.length} sentetik ping yazıldı`);

  // 4) Analiz
  const analiz = await gorevIziAnalizEt(task.id);
  if (!analiz) throw new Error("Analiz üretilemedi");
  console.log("✓ Analiz sonucu:", {
    sonuc: analiz.sonuc,
    veriKalitesi: analiz.veriKalitesi,
    uyumYuzde: analiz.uyumYuzde,
    kapsamaYuzde: analiz.kapsamaYuzde,
    maxSapmaM: analiz.maxSapmaM,
    sapmaOlayi: (analiz.sapmalar as unknown[]).length,
    duraklama: (analiz.duraklamalar as unknown[]).length,
    veriBoslugu: (analiz.veriBosluklari as unknown[]).length,
    sureDk: analiz.sureDk,
    ortalamaHizKmh: analiz.ortalamaHizKmh,
    pingSayisi: analiz.pingSayisi,
  });

  const beklenti = [
    [(analiz.sapmalar as unknown[]).length >= 1, "≥1 sapma olayı"],
    [(analiz.duraklamalar as unknown[]).length >= 1, "≥1 duraklama"],
    [(analiz.veriBosluklari as unknown[]).length >= 1, "≥1 veri boşluğu"],
    [analiz.uyumYuzde > 50 && analiz.uyumYuzde < 100, "uyum %50-100 arası"],
    [analiz.maxSapmaM != null && analiz.maxSapmaM > 250, "max sapma > 250 m"],
    [analiz.rotaGiris != null && analiz.rotaCikis != null, "rota giriş/çıkış dolu"],
  ] as const;
  for (const [ok, ad] of beklenti) {
    if (!ok) throw new Error(`Beklenti sağlanmadı: ${ad}`);
    console.log(`  ✓ ${ad}`);
  }

  // 5) Canlı sapma bildirimi (eşik süresi geçici olarak 0.01 dk'ya indirilir)
  await prisma.appSetting.upsert({
    where: { key: "sapmaUyariDk" },
    update: { value: "0.01" },
    create: { key: "sapmaUyariDk", value: "0.01" },
  });
  const disLat = LAT0 + 500 * M_LAT;
  await canliSapmaKontrol(vehicle.id, disLat, LNG0 + 200 * M_LNG); // sapma başlangıcı
  await new Promise((r) => setTimeout(r, 1500));
  await canliSapmaKontrol(vehicle.id, disLat, LNG0 + 220 * M_LNG); // eşik aşıldı → bildirim
  const bildirim = await prisma.notification.findFirst({
    where: { anahtar: { startsWith: `sapma:${task.id}:` } },
  });
  if (!bildirim) throw new Error("Canlı sapma bildirimi oluşmadı");
  console.log("✓ Canlı sapma bildirimi:", bildirim.baslik);
  // Tekrar çağrı → yeni bildirim oluşmamalı (aynı olay)
  await canliSapmaKontrol(vehicle.id, disLat, LNG0 + 240 * M_LNG);
  const sayi = await prisma.notification.count({
    where: { anahtar: { startsWith: `sapma:${task.id}:` } },
  });
  console.log(`✓ Bildirim tekrarı yok (olay başına kullanıcı başına 1): ${sayi} kayıt`);

  // 6) Temizlik
  await prisma.notification.deleteMany({
    where: { anahtar: { startsWith: `sapma:${task.id}:` } },
  });
  await prisma.appSetting.delete({ where: { key: "sapmaUyariDk" } }).catch(() => {});
  await prisma.routeTrackAnalysis.deleteMany({ where: { taskId: task.id } });
  await prisma.vehicleLocation.deleteMany({
    where: { vehicleId: vehicle.id, zaman: { gte: cikis } },
  });
  await prisma.vehicleTask.delete({ where: { id: task.id } });
  await prisma.dispatchJob.delete({ where: { id: job.id } });
  await prisma.cleaningRoute.delete({ where: { id: rota.id } });
  console.log("✓ Test verisi temizlendi");
}

main()
  .then(() => {
    console.log("\nSMOKE TAKIP: TAMAM");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\nSMOKE TAKIP: HATA:", e);
    process.exit(1);
  });
