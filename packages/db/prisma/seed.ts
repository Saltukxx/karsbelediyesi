/**
 * Seed: Excel dosyalarından çıkarılan tüm tanım verileri.
 * - 23 mahalle, 10 müdürlük, 10 şikayet türü (+müdürlük eşlemesi)
 * - 11 araç cinsi, 3 onaylayan kullanıcı, admin kullanıcı
 * - 5 kontrol listesi şablonu (195 kalem)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  MAHALLELER,
  MUDURLUKLER,
  SIKAYET_TURLERI,
  ARAC_CINSLERI,
  ONAYLAYANLAR,
  KONTROL_LISTESI_SABLONLARI,
  toplamKalemSayisi,
} from "@kars/shared";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed başlıyor...");

  // ── Mahalleler ──
  for (const name of MAHALLELER) {
    await prisma.neighborhood.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✓ ${MAHALLELER.length} mahalle`);

  // ── Müdürlükler ──
  for (const m of MUDURLUKLER) {
    await prisma.department.upsert({
      where: { name: m.name },
      update: { shortName: m.shortName },
      create: { name: m.name, shortName: m.shortName },
    });
  }
  console.log(`✓ ${MUDURLUKLER.length} müdürlük`);

  // ── Şikayet türleri (varsayılan müdürlük eşlemesiyle) ──
  for (const t of SIKAYET_TURLERI) {
    const dep = await prisma.department.findUnique({ where: { name: t.defaultDepartment } });
    await prisma.complaintType.upsert({
      where: { name: t.name },
      update: { defaultDepartmentId: dep?.id },
      create: { name: t.name, defaultDepartmentId: dep?.id },
    });
  }
  console.log(`✓ ${SIKAYET_TURLERI.length} şikayet türü`);

  // ── Araç cinsleri ──
  for (const name of ARAC_CINSLERI) {
    await prisma.vehicleType.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✓ ${ARAC_CINSLERI.length} araç cinsi`);

  // ── Kontrol listesi şablonları (195 kalem) ──
  for (const sablon of KONTROL_LISTESI_SABLONLARI) {
    const template = await prisma.checklistTemplate.upsert({
      where: { ekipmanAdi: sablon.ekipmanAdi },
      update: { aciklama: sablon.aciklama },
      create: { ekipmanAdi: sablon.ekipmanAdi, aciklama: sablon.aciklama },
    });
    let siraNo = 0;
    for (const kat of sablon.kategoriler) {
      for (const kalem of kat.kalemler) {
        siraNo += 1;
        await prisma.checklistTemplateItem.upsert({
          where: { templateId_siraNo: { templateId: template.id, siraNo } },
          update: { kategori: kat.kategori, kontrolKalemi: kalem },
          create: {
            templateId: template.id,
            kategori: kat.kategori,
            siraNo,
            kontrolKalemi: kalem,
          },
        });
      }
    }
    console.log(`✓ ${sablon.ekipmanAdi}: ${toplamKalemSayisi(sablon)} kontrol kalemi`);
  }

  // ── Kullanıcılar ──
  const adminPass = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { phone: "05000000000" },
    update: {},
    create: {
      name: "Sistem Yöneticisi",
      phone: "05000000000",
      email: "admin@kars.bel.tr",
      passwordHash: adminPass,
      role: "ADMIN",
    },
  });
  console.log("✓ Admin kullanıcı (tel: 05000000000, şifre: admin123 — canlıda değiştirin!)");

  // Excel KAPALI İŞLER/RAPORLAMA "Onaylayan" dropdown'ındaki 3 kişi
  let i = 1;
  for (const ad of ONAYLAYANLAR) {
    const pass = await bcrypt.hash("onay123", 10);
    await prisma.user.upsert({
      where: { phone: `0500000000${i}` },
      update: {},
      create: {
        name: ad,
        phone: `0500000000${i}`,
        passwordHash: pass,
        role: "APPROVER",
      },
    });
    i += 1;
  }
  console.log(`✓ ${ONAYLAYANLAR.length} onaylayan kullanıcı`);

  // Call center + müdür (E2E / panel RBAC)
  const ccPass = await bcrypt.hash("cc123", 10);
  await prisma.user.upsert({
    where: { phone: "05000000010" },
    update: { role: "CALL_CENTER", passwordHash: ccPass },
    create: {
      name: "Çağrı Merkezi",
      phone: "05000000010",
      passwordHash: ccPass,
      role: "CALL_CENTER",
    },
  });

  const deptA = await prisma.department.findFirst({ orderBy: { name: "asc" } });
  const deptB = await prisma.department.findFirst({
    where: deptA ? { id: { not: deptA.id } } : undefined,
    orderBy: { name: "asc" },
  });
  if (deptA) {
    const mudurPass = await bcrypt.hash("mudur123", 10);
    await prisma.user.upsert({
      where: { phone: "05000000020" },
      update: {
        role: "DEPARTMENT_MANAGER",
        departmentId: deptA.id,
        passwordHash: mudurPass,
      },
      create: {
        name: "Müdürlük Yöneticisi",
        phone: "05000000020",
        passwordHash: mudurPass,
        role: "DEPARTMENT_MANAGER",
        departmentId: deptA.id,
      },
    });

    const yil = new Date().getFullYear();
    const baseSira = 9000;
    await prisma.complaint.upsert({
      where: { sikayetNo: `ŞKY-${yil}-9001` },
      update: {
        arayanKisi: "E2E-DEPT-A",
        departmentId: deptA.id,
        durum: "ACIK",
      },
      create: {
        sikayetNo: `ŞKY-${yil}-9001`,
        yil,
        sira: baseSira + 1,
        arayanKisi: "E2E-DEPT-A",
        telefon: "05001112233",
        departmentId: deptA.id,
        kanal: "TELEFON",
        durum: "ACIK",
      },
    });
    if (deptB) {
      await prisma.complaint.upsert({
        where: { sikayetNo: `ŞKY-${yil}-9002` },
        update: {
          arayanKisi: "E2E-DEPT-B",
          departmentId: deptB.id,
          durum: "ACIK",
        },
        create: {
          sikayetNo: `ŞKY-${yil}-9002`,
          yil,
          sira: baseSira + 2,
          arayanKisi: "E2E-DEPT-B",
          telefon: "05001112244",
          departmentId: deptB.id,
          kanal: "TELEFON",
          durum: "ACIK",
        },
      });
    }
  }
  console.log("✓ CALL_CENTER + DEPARTMENT_MANAGER + izolasyon şikayetleri");

  // ── Malzeme depo örnekleri (MalzemeDepo Envanter) ──
  const malzemeler = [
    {
      kod: "MLZ-0001",
      ad: "PVC Boru 110mm (6m boy)",
      kategori: "Sıhhi Tesisat Malzemesi",
      birim: "Adet",
      depoLokasyon: "Ana Depo (Merkez)",
      kritikStok: 50,
      birimFiyat: 285,
    },
    {
      kod: "MLZ-0002",
      ad: "Çimento CEM I 42.5",
      kategori: "İnşaat Malzemesi",
      birim: "Ton",
      depoLokasyon: "Beton Santrali Deposu",
      kritikStok: 20,
      birimFiyat: 2800,
    },
  ];
  for (const m of malzemeler) {
    await prisma.material.upsert({
      where: { kod: m.kod },
      update: m,
      create: m,
    });
  }
  console.log(`✓ ${malzemeler.length} malzeme kartı`);

  // ── Beton reçeteleri (Beton Receteleri.xlsx) ──
  const receteler = [
    { sinif: "C20", cimentoKg: 300, kumKg: 670, micir05Kg: 190, micir512Kg: 480, micir1219Kg: 575, suLt: 180, katkiKg: 3, aciklama: "Standart tasiyici beton" },
    { sinif: "C25", cimentoKg: 340, kumKg: 660, micir05Kg: 190, micir512Kg: 470, micir1219Kg: 565, suLt: 175, katkiKg: 3.5, aciklama: "Standart tasiyici beton" },
    { sinif: "C30", cimentoKg: 380, kumKg: 645, micir05Kg: 185, micir512Kg: 460, micir1219Kg: 555, suLt: 170, katkiKg: 4, aciklama: "Yuksek dayanim" },
    { sinif: "C35", cimentoKg: 420, kumKg: 630, micir05Kg: 180, micir512Kg: 450, micir1219Kg: 545, suLt: 165, katkiKg: 5, aciklama: "Yuksek dayanim / ozel imalat" },
    { sinif: "C40", cimentoKg: 450, kumKg: 615, micir05Kg: 175, micir512Kg: 440, micir1219Kg: 535, suLt: 160, katkiKg: 5.5, aciklama: "Ozel imalat" },
  ];
  for (const r of receteler) {
    await prisma.concreteRecipe.upsert({
      where: { sinif: r.sinif },
      update: r,
      create: r,
    });
  }
  for (const malzeme of ["Cimento", "Kum", "Micir 0-5mm", "Micir 5-12mm", "Micir 12-19mm", "Su", "Katki"]) {
    await prisma.concreteStock.upsert({
      where: { malzeme },
      update: {},
      create: {
        malzeme,
        birim: malzeme === "Su" ? "lt" : "kg",
        baslangicStok: 0,
        toplamGiris: 0,
        kritikSeviye: 1000,
      },
    });
  }
  console.log(`✓ ${receteler.length} beton reçetesi + stok kartları`);

  // ── Agrega parametreleri ──
  await prisma.agregaParams.upsert({
    where: { ad: "varsayilan" },
    update: {},
    create: {
      ad: "varsayilan",
      boyutSatis: [
        { boyut: "0-5 mm", oran: 0.3, satisFiyati: 180, stokHedefi: 1000 },
        { boyut: "5-12 mm", oran: 0.25, satisFiyati: 220, stokHedefi: 1000 },
        { boyut: "12-19 mm", oran: 0.25, satisFiyati: 240, stokHedefi: 1000 },
        { boyut: "19-32 mm", oran: 0.2, satisFiyati: 250, stokHedefi: 1000 },
      ],
    },
  });
  console.log("✓ Agrega parametreleri");

  // ── Bitüm ayarlar + depolar ──
  await prisma.bitumSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  const depolar = [
    { ad: "Kiralık Tanker 1", tip: "KIRALIK" as const, kapasite: 80 },
    { ad: "Kiralık Tanker 2", tip: "KIRALIK" as const, kapasite: 80 },
    { ad: "Ana Depo 1", tip: "ANA_DEPO" as const, kapasite: 80 },
    { ad: "Ana Depo 2", tip: "ANA_DEPO" as const, kapasite: 80 },
    { ad: "Ana Depo 3", tip: "ANA_DEPO" as const, kapasite: 80 },
    { ad: "Ana Depo 4", tip: "ANA_DEPO" as const, kapasite: 80 },
  ];
  for (const d of depolar) {
    await prisma.bitumDepot.upsert({
      where: { ad: d.ad },
      update: { tip: d.tip, kapasite: d.kapasite },
      create: d,
    });
  }
  console.log(`✓ Bitüm ayarları + ${depolar.length} depo`);

  console.log("Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
