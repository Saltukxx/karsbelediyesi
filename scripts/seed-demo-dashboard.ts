/**
 * Dashboard grafiklerini yerelde görebilmek için son ~100 güne yayılmış
 * gerçekçi şikayet / görev / yakıt / bakım verisi üretir.
 *
 * Sadece geliştirme içindir: şikayet, görev, yakıt ve bakım tablolarını
 * temizleyip yeniden doldurur. Bu yüzden localhost dışındaki bir veritabanına
 * bağlıysa çalışmayı reddeder.
 *
 * Kullanım: npx tsx scripts/seed-demo-dashboard.ts
 */
import { prisma } from "@kars/db";

const KARS_MERKEZ = { lat: 40.6013, lng: 43.0975 };
const GUN_SAYISI = 100;
const SIKAYET_SAYISI = 460;
const GOREV_SAYISI = 120;
const YAKIT_SAYISI = 340;
const BAKIM_SAYISI = 90;

function guardLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  const local = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
  if (!local) {
    throw new Error(
      "Bu script yalnızca yerel veritabanında çalışır. DATABASE_URL localhost değil.",
    );
  }
}

/** Deterministik sözde rastgele: her çalıştırmada aynı tablo çıksın. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rnd = createRandom(20260828);

function randInt(minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rnd() * (maxInclusive - minInclusive + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rnd() * items.length)]!;
}

/** Ağırlıklı seçim: [[deger, agirlik], ...] */
function weighted<T>(pairs: ReadonlyArray<readonly [T, number]>): T {
  const toplam = pairs.reduce((a, p) => a + p[1], 0);
  let esik = rnd() * toplam;
  for (const [value, weight] of pairs) {
    esik -= weight;
    if (esik <= 0) return value;
  }
  return pairs[pairs.length - 1]![0];
}

/**
 * Çağrı merkezi saat dağılımı: mesai içi iki tepe (10 ve 15), gece neredeyse boş.
 * Saatlik yoğunluk ısı haritasının anlamlı görünmesi bu dağılıma bağlı.
 */
const SAAT_AGIRLIK: ReadonlyArray<readonly [number, number]> = Array.from(
  { length: 24 },
  (_, saat) => {
    if (saat < 6) return [saat, 0.4] as const;
    if (saat < 8) return [saat, 2] as const;
    if (saat < 12) return [saat, 10] as const;
    if (saat < 14) return [saat, 6] as const;
    if (saat < 18) return [saat, 9] as const;
    if (saat < 21) return [saat, 4] as const;
    return [saat, 1.2] as const;
  },
);

function gecmisTarih(gunOnce: number, saat: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - gunOnce);
  d.setHours(saat, randInt(0, 59), randInt(0, 59), 0);
  return d;
}

/** Hafta sonu daha az şikayet gelir; gün seçimi buna göre ağırlıklanır. */
function gunSec(): number {
  for (let deneme = 0; deneme < 8; deneme += 1) {
    const gunOnce = randInt(0, GUN_SAYISI - 1);
    const tarih = new Date();
    tarih.setDate(tarih.getDate() - gunOnce);
    const haftaSonu = tarih.getDay() === 0 || tarih.getDay() === 6;
    if (!haftaSonu || rnd() < 0.35) return gunOnce;
  }
  return randInt(0, GUN_SAYISI - 1);
}

async function temizle() {
  // Bağımlı kayıtlar önce silinir, aksi halde foreign key hatası alınır.
  await prisma.complaintEvent.deleteMany({});
  await prisma.complaintPersonnel.deleteMany({});
  await prisma.complaintPhoto.deleteMany({});
  await prisma.fuelRecord.deleteMany({});
  await prisma.materialMovement.deleteMany({ where: { vehicleTaskId: { not: null } } });
  await prisma.maintenanceRecord.deleteMany({});
  await prisma.vehicleTask.deleteMany({});
  await prisma.complaint.deleteMany({});
}

async function araclariHazirla(departmentIds: string[]) {
  const mevcut = await prisma.vehicle.count();
  const hedef = 16;
  if (mevcut >= hedef) {
    return prisma.vehicle.findMany({ select: { id: true } });
  }

  const tipler = await prisma.vehicleType.findMany({ select: { id: true } });
  const operasyon = [
    "MUSAIT",
    "MUSAIT",
    "MUSAIT",
    "GOREVDE",
    "GOREVDE",
    "BAKIMDA",
    "ARIZALI",
    "PLANLI_BAKIM",
  ] as const;

  for (let i = mevcut; i < hedef; i += 1) {
    const bugun = new Date();
    // Bir kısmının muayene/sigortası yaklaşsın ki uyarı bandı da dolsun.
    const muayeneGun = i % 4 === 0 ? randInt(-10, 25) : randInt(120, 400);
    const sigortaGun = i % 5 === 0 ? randInt(-5, 28) : randInt(90, 380);

    await prisma.vehicle.create({
      data: {
        plaka: `36 DM ${String(100 + i).padStart(3, "0")}`,
        ad: `Demo Araç ${i + 1}`,
        vehicleTypeId: tipler.length ? pick(tipler).id : null,
        marka: pick(["Ford", "Mercedes", "Iveco", "BMC", "Isuzu"]),
        model: pick(["Cargo", "Atego", "Eurocargo", "Pro", "NPR"]),
        modelYili: randInt(2012, 2024),
        yakitTipi: "DIZEL",
        sayacDeger: randInt(40_000, 320_000),
        sayacTipi: "KM",
        normTuketim: randInt(18, 42),
        departmentId: departmentIds.length ? pick(departmentIds) : null,
        operasyonDurumu: operasyon[i % operasyon.length],
        envanterDurumu: i % 11 === 10 ? "HURDAYA_AYRILDI" : "AKTIF",
        muayeneTarihi: new Date(
          bugun.getTime() + muayeneGun * 24 * 60 * 60 * 1000,
        ),
        sigortaBitis: new Date(
          bugun.getTime() + sigortaGun * 24 * 60 * 60 * 1000,
        ),
      },
    });
  }

  return prisma.vehicle.findMany({ select: { id: true } });
}

async function sikayetUret(
  departmentIds: string[],
  typeIds: string[],
  neighborhoodIds: string[],
) {
  // Birkaç müdürlük ve mahalle belirgin şekilde öne çıksın; grafikler düz olmasın.
  const mudurlukAgirlik = departmentIds.map(
    (id, i) => [id, i === 0 ? 30 : i === 1 ? 22 : i === 2 ? 14 : 6] as const,
  );
  const mahalleAgirlik = neighborhoodIds.map(
    (id, i) => [id, i < 3 ? 18 : i < 7 ? 9 : 3] as const,
  );
  const turAgirlik = typeIds.map(
    (id, i) => [id, i === 0 ? 26 : i === 1 ? 18 : i < 4 ? 11 : 5] as const,
  );

  const yil = new Date().getFullYear();
  const rows = [];

  for (let i = 0; i < SIKAYET_SAYISI; i += 1) {
    const durum = weighted([
      ["KAPATILDI", 56],
      ["DEVAM_EDIYOR", 22],
      ["ACIK", 20],
      ["IPTAL", 2],
    ] as const);

    // Açık kayıtlar son günlere yığılsın ki SLA'nın üç kovası da dolsun.
    const gunOnce =
      durum === "ACIK" || durum === "DEVAM_EDIYOR"
        ? weighted([
            [randInt(0, 1), 30],
            [randInt(1, 3), 28],
            [randInt(3, 20), 42],
          ] as const)
        : gunSec();

    const kayitTarihi = gecmisTarih(gunOnce, weighted(SAAT_AGIRLIK));
    const kapanisTarihi =
      durum === "KAPATILDI"
        ? new Date(
            kayitTarihi.getTime() +
              randInt(2, 240) * 60 * 60 * 1000 +
              randInt(0, 59) * 60 * 1000,
          )
        : null;

    // Şikayetlerin bir kısmının konumu girilmemiş olur ("konum eksik" kartı).
    const konumVar = rnd() > 0.14;

    rows.push({
      sikayetNo: `ŞKY-${yil}-${String(i + 1).padStart(4, "0")}`,
      yil,
      sira: i + 1,
      kanal: weighted([
        ["TELEFON", 55],
        ["WHATSAPP", 30],
        ["WEB", 15],
      ] as const),
      kayitTarihi,
      arayanKisi: `${pick(["Ahmet", "Ayşe", "Mehmet", "Fatma", "Ali", "Zeynep", "Hasan", "Elif"])} ${pick(["Yılmaz", "Demir", "Kaya", "Şahin", "Çelik", "Aydın"])}`,
      telefon: `05${randInt(30, 59)}${randInt(1000000, 9999999)}`,
      neighborhoodId: weighted(mahalleAgirlik),
      complaintTypeId: weighted(turAgirlik),
      departmentId: weighted(mudurlukAgirlik),
      aciklama: pick([
        "Yol üzerinde çukur oluşmuş.",
        "Çöp konteyneri taşmış durumda.",
        "Sokak lambası yanmıyor.",
        "Kanalizasyon taşkını var.",
        "Kaldırım işgali şikayeti.",
        "Su birikintisi geçişi engelliyor.",
      ]),
      oncelik: weighted([
        ["NORMAL", 70],
        ["ACIL", 22],
        ["COK_ACIL", 8],
      ] as const),
      durum,
      kapanisTarihi,
      cozumNotu: durum === "KAPATILDI" ? "Ekip yönlendirildi, sorun giderildi." : null,
      lat: konumVar ? KARS_MERKEZ.lat + (rnd() - 0.5) * 0.075 : null,
      lng: konumVar ? KARS_MERKEZ.lng + (rnd() - 0.5) * 0.11 : null,
    });
  }

  await prisma.complaint.createMany({ data: rows });
  return rows.length;
}

async function gorevUret(vehicleIds: string[], departmentIds: string[]) {
  const yil = new Date().getFullYear();
  const rows = [];

  for (let i = 0; i < GOREV_SAYISI; i += 1) {
    const durum = weighted([
      ["TAMAMLANDI", 62],
      ["DEVAM_EDIYOR", 20],
      ["PLANLANDI", 14],
      ["IPTAL_EDILDI", 4],
    ] as const);
    const gunOnce = gunSec();
    const cikis = gecmisTarih(gunOnce, randInt(7, 16));
    const sureSaat = randInt(1, 9);
    const giris =
      durum === "TAMAMLANDI"
        ? new Date(cikis.getTime() + sureSaat * 60 * 60 * 1000)
        : null;

    rows.push({
      gorevNo: `GRV-${yil}-${String(i + 1).padStart(4, "0")}`,
      yil,
      sira: i + 1,
      talepTarihi: cikis,
      vehicleId: pick(vehicleIds),
      talepEdenDepartmentId: departmentIds.length ? pick(departmentIds) : null,
      gorevYeri: pick([
        "Cumhuriyet Caddesi",
        "Ortakapı Mahallesi",
        "Sanayi Sitesi",
        "Kale çevresi",
        "Yenişehir",
      ]),
      gorevTanimi: pick([
        "Yol bakım çalışması",
        "Çöp toplama turu",
        "Kar küreme",
        "Malzeme nakli",
        "Kanal temizliği",
      ]),
      cikisTarihi: cikis,
      girisTarihi: giris,
      sureSaat: giris ? sureSaat : null,
      kmSayacCikis: randInt(10_000, 200_000),
      durum,
      maliyet: durum === "TAMAMLANDI" ? randInt(400, 4200) : null,
    });
  }

  await prisma.vehicleTask.createMany({ data: rows });
  return rows.length;
}

async function yakitVeBakimUret(vehicleIds: string[]) {
  const yakitRows = [];
  for (let i = 0; i < YAKIT_SAYISI; i += 1) {
    // Maliyet trendi aylık kırılım gösterdiği için ~7 aya yayılır.
    const gunOnce = randInt(0, 210);
    const litre = randInt(40, 320);
    const birimFiyat = 42 + rnd() * 8;
    yakitRows.push({
      vehicleId: pick(vehicleIds),
      tarih: gecmisTarih(gunOnce, randInt(8, 17)),
      yakitTuru: "MOTORIN" as const,
      litre,
      birimFiyat: Number(birimFiyat.toFixed(2)),
      tutar: Number((litre * birimFiyat).toFixed(2)),
      sayac: randInt(20_000, 300_000),
    });
  }
  await prisma.fuelRecord.createMany({ data: yakitRows });

  const bakimRows = [];
  for (let i = 0; i < BAKIM_SAYISI; i += 1) {
    const gunOnce = randInt(0, 210);
    bakimRows.push({
      vehicleId: pick(vehicleIds),
      bakimTarihi: gecmisTarih(gunOnce, randInt(9, 16)),
      bakimTuru: weighted([
        ["PERIYODIK", 40],
        ["YAG_DEGISIMI", 22],
        ["ARIZA_ONARIMI", 20],
        ["LASTIK", 12],
        ["BUYUK_BAKIM", 6],
      ] as const),
      yapilanIslemler: pick([
        "Yağ ve filtre değişimi",
        "Fren balata yenileme",
        "Lastik rotasyonu",
        "Hidrolik hortum değişimi",
        "Genel kontrol",
      ]),
      maliyet: randInt(1500, 28_000),
      durum: "TAMAMLANDI" as const,
      yapanFirmaPersonel: pick(["Kars Oto Servis", "Belediye Atölye", "Doğu Ticaret"]),
    });
  }
  await prisma.maintenanceRecord.createMany({ data: bakimRows });

  return { yakit: yakitRows.length, bakim: bakimRows.length };
}

async function main() {
  guardLocalDatabase();

  const [departments, types, neighborhoods] = await Promise.all([
    prisma.department.findMany({ select: { id: true } }),
    prisma.complaintType.findMany({ select: { id: true } }),
    prisma.neighborhood.findMany({ select: { id: true } }),
  ]);

  if (!departments.length || !types.length || !neighborhoods.length) {
    throw new Error("Önce `npm run db:seed` ile temel tanımları yükleyin.");
  }

  const departmentIds = departments.map((d) => d.id);
  const typeIds = types.map((t) => t.id);
  const neighborhoodIds = neighborhoods.map((n) => n.id);

  await temizle();
  const vehicles = await araclariHazirla(departmentIds);
  const vehicleIds = vehicles.map((v) => v.id);

  const sikayet = await sikayetUret(departmentIds, typeIds, neighborhoodIds);
  const gorev = await gorevUret(vehicleIds, departmentIds);
  const { yakit, bakim } = await yakitVeBakimUret(vehicleIds);

  console.log(
    `Demo veri hazır — şikayet: ${sikayet}, görev: ${gorev}, yakıt: ${yakit}, bakım: ${bakim}, araç: ${vehicleIds.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
