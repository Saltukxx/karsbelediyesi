import { prisma, Prisma } from "@kars/db";
import {
  betonGuncelStok,
  betonStokDurumu,
  mevcutStok,
  stokDurumu,
  toplamOperasyonMaliyeti,
} from "@kars/shared";
import type { AppSession } from "@/lib/authz";
import { departmentScope } from "@/lib/authz";
import {
  buildDailySeries,
  makeDelta,
  type DashboardRange,
  type Delta,
} from "@/lib/dashboard-range";

type DeptScope = ReturnType<typeof departmentScope>;

export type DashboardData = {
  /** Seçili dönemde oluşan/kapanan hareketler — önceki dönemle karşılaştırmalı */
  kpi: {
    yeniSikayet: Delta;
    kapatilanSikayet: Delta;
    ortKapanisGun: Delta;
    tamamlananGorev: Delta;
    operasyonMaliyeti: Delta;
  };
  /** Anlık durum göstergeleri — tarih aralığından bağımsız */
  anlik: {
    acikSikayet: number;
    devamEdenSikayet: number;
    cokAcil: number;
    acil: number;
    acilSikayet: number;
    onayBekleyenWhatsApp: number;
    devamGorev: number;
    yaklasanMuayene: number;
    kritikStokToplam: number;
    kritikMalzeme: number;
    kritikBeton: number;
    kritikBitum: number;
    aracOperasyon: Record<string, number>;
    aracEnvanter: Record<string, number>;
  };
  trend: Array<{ gun: string; acilan: number; kapanan: number }>;
  maliyetTrend: Array<{ ay: string; bakim: number; yakit: number }>;
  mudurlukDagilim: Array<{
    id: string | null;
    name: string;
    toplam: number;
    acik: number;
    devam: number;
    kapatildi: number;
    cokAcil: number;
    acil: number;
  }>;
  turDagilim: Array<{
    name: string;
    toplam: number;
    acik: number;
    kapatildi: number;
  }>;
  /** Şikayetlerin geldiği kanal (telefon / WhatsApp / web) */
  kanalDagilim: Array<{ kanal: string; toplam: number }>;
  /** En çok şikayet üreten mahalleler */
  mahalleDagilim: Array<{ name: string; toplam: number }>;
  /** Hafta günü (1=Pzt … 7=Paz) × saat yoğunluk matrisi */
  saatlikYogunluk: Array<{ haftaGunu: number; saat: number; adet: number }>;
  sonBakimlar: Array<{
    id: string;
    plaka: string;
    ad: string | null;
    sonrakiBakimTarihi: Date | null;
  }>;
};

/**
 * `departmentScope` sonucunu ham SQL koşuluna çevirir.
 * `column` çağrı yerinde sabit yazılır, dışarıdan veri almaz.
 */
function deptSql(scope: DeptScope, column = '"departmentId"'): Prisma.Sql {
  if (!("departmentId" in scope)) return Prisma.empty;
  const col = Prisma.raw(column);
  const value = scope.departmentId;
  if (typeof value === "string") return Prisma.sql` AND ${col} = ${value}`;
  // { in: [] } → müdürlüğü olmayan yönetici: hiçbir kayıt görmemeli
  if (value.in.length === 0) return Prisma.sql` AND FALSE`;
  return Prisma.sql` AND ${col} IN (${Prisma.join(value.in)})`;
}

/** Bakım/yakıt kayıtları araç üzerinden müdürlüğe bağlanır. */
function vehicleScope(scope: DeptScope) {
  return "departmentId" in scope ? { vehicle: scope } : {};
}

type DayRow = { gun: Date; adet: number };
type MonthRow = { ay: Date; toplam: number };

export async function computeDashboard(
  session: AppSession,
  range: DashboardRange,
): Promise<DashboardData> {
  const dept = departmentScope(session);
  const vScope = vehicleScope(dept);
  const inRange = { gte: range.bas, lte: range.bit };
  const inPrev = { gte: range.onceki.bas, lte: range.onceki.bit };

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);

  const [
    yeniSikayet,
    yeniSikayetOnceki,
    kapatilan,
    kapatilanOnceki,
    kapanisSure,
    tamamlananGorev,
    tamamlananGorevOnceki,
    bakimTutar,
    bakimTutarOnceki,
    yakitTutar,
    yakitTutarOnceki,
    acikSikayet,
    devamEdenSikayet,
    cokAcil,
    acil,
    acilSikayet,
    onayBekleyenWhatsApp,
    devamGorev,
    yaklasanMuayene,
    aracDurum,
    envanterDurum,
    deptDurum,
    deptOncelik,
    departments,
    turDurum,
    complaintTypes,
    kanalGruplari,
    mahalleGruplari,
    neighborhoods,
    saatlikYogunluk,
    sonBakimlar,
    trendAcilan,
    trendKapanan,
    bakimAylik,
    yakitAylik,
    materials,
    materialSums,
    betonStocks,
    betonCikis,
    bitumSettings,
    bitumDepots,
    bitumAlis,
    bitumTasima,
    bitumKullanim,
  ] = await Promise.all([
    prisma.complaint.count({ where: { kayitTarihi: inRange, ...dept } }),
    prisma.complaint.count({ where: { kayitTarihi: inPrev, ...dept } }),
    prisma.complaint.count({
      where: { durum: "KAPATILDI", kapanisTarihi: inRange, ...dept },
    }),
    prisma.complaint.count({
      where: { durum: "KAPATILDI", kapanisTarihi: inPrev, ...dept },
    }),
    prisma.$queryRaw<Array<{ donem: string; ortalama: number | null }>>`
      SELECT donem, AVG(EXTRACT(EPOCH FROM ("kapanisTarihi" - "kayitTarihi")) / 86400.0)::float AS ortalama
      FROM (
        SELECT 'current' AS donem, "kayitTarihi", "kapanisTarihi"
        FROM "Complaint"
        WHERE "durum" = 'KAPATILDI'
          AND "kapanisTarihi" >= ${range.bas} AND "kapanisTarihi" <= ${range.bit}
          ${deptSql(dept)}
        UNION ALL
        SELECT 'previous' AS donem, "kayitTarihi", "kapanisTarihi"
        FROM "Complaint"
        WHERE "durum" = 'KAPATILDI'
          AND "kapanisTarihi" >= ${range.onceki.bas} AND "kapanisTarihi" <= ${range.onceki.bit}
          ${deptSql(dept)}
      ) t
      GROUP BY donem
    `,
    prisma.vehicleTask.count({
      where: { durum: "TAMAMLANDI", girisTarihi: inRange, ...taskScope(dept) },
    }),
    prisma.vehicleTask.count({
      where: { durum: "TAMAMLANDI", girisTarihi: inPrev, ...taskScope(dept) },
    }),
    prisma.maintenanceRecord.aggregate({
      where: { bakimTarihi: inRange, ...vScope },
      _sum: { maliyet: true },
    }),
    prisma.maintenanceRecord.aggregate({
      where: { bakimTarihi: inPrev, ...vScope },
      _sum: { maliyet: true },
    }),
    prisma.fuelRecord.aggregate({
      where: { tarih: inRange, ...vScope },
      _sum: { tutar: true },
    }),
    prisma.fuelRecord.aggregate({
      where: { tarih: inPrev, ...vScope },
      _sum: { tutar: true },
    }),
    prisma.complaint.count({ where: { durum: "ACIK", ...dept } }),
    prisma.complaint.count({ where: { durum: "DEVAM_EDIYOR", ...dept } }),
    prisma.complaint.count({
      where: { oncelik: "COK_ACIL", durum: { not: "KAPATILDI" }, ...dept },
    }),
    prisma.complaint.count({
      where: { oncelik: "ACIL", durum: { not: "KAPATILDI" }, ...dept },
    }),
    prisma.complaint.count({
      where: {
        oncelik: { in: ["ACIL", "COK_ACIL"] },
        durum: { in: ["ACIK", "DEVAM_EDIYOR"] },
        ...dept,
      },
    }),
    prisma.whatsAppMessage.count({ where: { onayDurumu: "ONAY_BEKLIYOR" } }),
    prisma.vehicleTask.count({
      where: { durum: "DEVAM_EDIYOR", ...taskScope(dept) },
    }),
    prisma.vehicle.count({
      where: {
        OR: [
          { muayeneTarihi: { lte: in30 } },
          { sigortaBitis: { lte: in30 } },
          { sonrakiBakimTarihi: { lte: in30 } },
        ],
        envanterDurumu: { not: "HURDAYA_AYRILDI" },
        ...dept,
      },
    }),
    prisma.vehicle.groupBy({
      by: ["operasyonDurumu"],
      where: dept,
      _count: { _all: true },
    }),
    prisma.vehicle.groupBy({
      by: ["envanterDurumu"],
      where: dept,
      _count: { _all: true },
    }),
    // Müdürlük dağılımı: satırları çekmeden veritabanında sayılır
    prisma.complaint.groupBy({
      by: ["departmentId", "durum"],
      where: { kayitTarihi: inRange, ...dept },
      _count: { _all: true },
    }),
    prisma.complaint.groupBy({
      by: ["departmentId", "oncelik"],
      where: { kayitTarihi: inRange, ...dept },
      _count: { _all: true },
    }),
    prisma.department.findMany({
      where: { aktif: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.complaint.groupBy({
      by: ["complaintTypeId", "durum"],
      where: { kayitTarihi: inRange, ...dept },
      _count: { _all: true },
    }),
    prisma.complaintType.findMany({
      where: { aktif: true },
      select: { id: true, name: true },
    }),
    prisma.complaint.groupBy({
      by: ["kanal"],
      where: { kayitTarihi: inRange, ...dept },
      _count: { _all: true },
    }),
    prisma.complaint.groupBy({
      by: ["neighborhoodId"],
      where: { kayitTarihi: inRange, ...dept },
      _count: { _all: true },
    }),
    prisma.neighborhood.findMany({ select: { id: true, name: true } }),
    prisma.$queryRaw<Array<{ haftagunu: number; saat: number; adet: number }>>`
      SELECT EXTRACT(ISODOW FROM (("kayitTarihi" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul'))::int AS haftagunu,
             EXTRACT(HOUR FROM (("kayitTarihi" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul'))::int AS saat,
             COUNT(*)::int AS adet
      FROM "Complaint"
      WHERE "kayitTarihi" >= ${range.bas} AND "kayitTarihi" <= ${range.bit}
        ${deptSql(dept)}
      GROUP BY 1, 2
    `,
    prisma.maintenanceRecord.findMany({
      where: vScope,
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sonrakiBakimTarihi: true,
        vehicle: { select: { plaka: true, ad: true } },
      },
    }),
    prisma.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', ("kayitTarihi" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul') AS gun,
             COUNT(*)::int AS adet
      FROM "Complaint"
      WHERE "kayitTarihi" >= ${range.bas} AND "kayitTarihi" <= ${range.bit}
        ${deptSql(dept)}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', ("kapanisTarihi" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul') AS gun,
             COUNT(*)::int AS adet
      FROM "Complaint"
      WHERE "kapanisTarihi" >= ${range.bas} AND "kapanisTarihi" <= ${range.bit}
        AND "durum" = 'KAPATILDI'
        ${deptSql(dept)}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<MonthRow[]>`
      SELECT date_trunc('month', ("m"."bakimTarihi" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul') AS ay,
             COALESCE(SUM("m"."maliyet"), 0)::float AS toplam
      FROM "MaintenanceRecord" "m"
      JOIN "Vehicle" "v" ON "v"."id" = "m"."vehicleId"
      WHERE "m"."bakimTarihi" >= ${range.bas} AND "m"."bakimTarihi" <= ${range.bit}
        ${deptSql(dept, '"v"."departmentId"')}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<MonthRow[]>`
      SELECT date_trunc('month', ("f"."tarih" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul') AS ay,
             COALESCE(SUM("f"."tutar"), 0)::float AS toplam
      FROM "FuelRecord" "f"
      JOIN "Vehicle" "v" ON "v"."id" = "f"."vehicleId"
      WHERE "f"."tarih" >= ${range.bas} AND "f"."tarih" <= ${range.bit}
        ${deptSql(dept, '"v"."departmentId"')}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.material.findMany({ where: { aktif: true } }),
    prisma.materialMovement.groupBy({
      by: ["materialId", "tip"],
      _sum: { miktar: true },
    }),
    prisma.concreteStock.findMany(),
    prisma.concreteProduction.aggregate({
      _sum: {
        cimentoKg: true,
        kumKg: true,
        micir05Kg: true,
        micir512Kg: true,
        micir1219Kg: true,
        suLt: true,
        katkiKg: true,
      },
    }),
    prisma.bitumSettings.findUnique({ where: { id: "default" } }),
    prisma.bitumDepot.findMany({ where: { aktif: true } }),
    // Bitüm: tüm hareketleri çekmek yerine depo kırılımında toplanır
    prisma.bitumMovement.groupBy({
      by: ["depoId"],
      where: { tip: "ALIS" },
      _sum: { miktarTon: true },
    }),
    prisma.bitumMovement.groupBy({
      by: ["kaynakDepoId", "hedefDepoId"],
      where: { tip: "TASIMA" },
      _sum: { miktarTon: true },
    }),
    prisma.bitumMovement.groupBy({
      by: ["kullanimDepoId", "depoId"],
      where: { tip: "KULLANIM" },
      _sum: { miktarTon: true },
    }),
  ]);

  // ── KPI'lar ────────────────────────────────────────────────────────────
  const ortalamaByDonem = new Map(
    kapanisSure.map((r) => [r.donem, r.ortalama ?? 0]),
  );
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const bakimTL = Number(bakimTutar._sum.maliyet ?? 0);
  const bakimTLOnceki = Number(bakimTutarOnceki._sum.maliyet ?? 0);
  const yakitTL = Number(yakitTutar._sum.tutar ?? 0);
  const yakitTLOnceki = Number(yakitTutarOnceki._sum.tutar ?? 0);

  const kpi = {
    yeniSikayet: makeDelta(yeniSikayet, yeniSikayetOnceki),
    kapatilanSikayet: makeDelta(kapatilan, kapatilanOnceki),
    ortKapanisGun: makeDelta(
      round1(ortalamaByDonem.get("current") ?? 0),
      round1(ortalamaByDonem.get("previous") ?? 0),
    ),
    tamamlananGorev: makeDelta(tamamlananGorev, tamamlananGorevOnceki),
    operasyonMaliyeti: makeDelta(
      toplamOperasyonMaliyeti(bakimTL, yakitTL),
      toplamOperasyonMaliyeti(bakimTLOnceki, yakitTLOnceki),
    ),
  };

  // ── Kritik stoklar ─────────────────────────────────────────────────────
  const kritikMalzeme = materials.filter((m) => {
    const giris = Number(
      materialSums.find((s) => s.materialId === m.id && s.tip === "GIRIS")?._sum
        .miktar ?? 0,
    );
    const cikis = Number(
      materialSums.find((s) => s.materialId === m.id && s.tip === "CIKIS")?._sum
        .miktar ?? 0,
    );
    return stokDurumu(mevcutStok(giris, cikis), m.kritikStok) === "KRITIK";
  }).length;

  const cikisSum = betonCikis._sum;
  const cikisMap: Record<string, number> = {
    Cimento: cikisSum.cimentoKg ?? 0,
    Kum: cikisSum.kumKg ?? 0,
    "Micir 0-5mm": cikisSum.micir05Kg ?? 0,
    "Micir 5-12mm": cikisSum.micir512Kg ?? 0,
    "Micir 12-19mm": cikisSum.micir1219Kg ?? 0,
    Su: cikisSum.suLt ?? 0,
    Katki: cikisSum.katkiKg ?? 0,
  };
  const kritikBeton = betonStocks.filter((s) => {
    const stok = betonGuncelStok(
      s.baslangicStok,
      s.toplamGiris,
      cikisMap[s.malzeme] ?? 0,
    );
    return betonStokDurumu(stok, s.kritikSeviye) === "KRITIK";
  }).length;

  let kritikBitum = 0;
  if (bitumSettings && bitumDepots.length) {
    for (const d of bitumDepots) {
      let stok = 0;
      stok += bitumAlis
        .filter((g) => g.depoId === d.id)
        .reduce((a, g) => a + (g._sum.miktarTon ?? 0), 0);
      for (const g of bitumTasima) {
        const miktar = g._sum.miktarTon ?? 0;
        if (g.kaynakDepoId === d.id) stok -= miktar;
        if (g.hedefDepoId === d.id) stok += miktar;
      }
      for (const g of bitumKullanim) {
        // Orijinal davranış: iki kolondan biri eşleşiyorsa bir kez düşülür
        if (g.kullanimDepoId === d.id || g.depoId === d.id) {
          stok -= g._sum.miktarTon ?? 0;
        }
      }
      const oran = d.kapasite > 0 ? stok / d.kapasite : 0;
      if (oran <= bitumSettings.kritikEsik) kritikBitum += 1;
    }
  }

  // ── Dağılımlar ─────────────────────────────────────────────────────────
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  const deptKeys = new Set<string | null>([
    ...deptDurum.map((g) => g.departmentId),
    ...deptOncelik.map((g) => g.departmentId),
  ]);

  const mudurlukDagilim = [...deptKeys]
    .map((id) => {
      const durumlar = deptDurum.filter((g) => g.departmentId === id);
      const oncelikler = deptOncelik.filter((g) => g.departmentId === id);
      const say = (durum: string) =>
        durumlar.find((g) => g.durum === durum)?._count._all ?? 0;
      const sayOncelik = (oncelik: string) =>
        oncelikler.find((g) => g.oncelik === oncelik)?._count._all ?? 0;
      return {
        id,
        name: id ? (deptNameById.get(id) ?? "—") : "Atanmamış",
        toplam: durumlar.reduce((a, g) => a + g._count._all, 0),
        acik: say("ACIK"),
        devam: say("DEVAM_EDIYOR"),
        kapatildi: say("KAPATILDI"),
        cokAcil: sayOncelik("COK_ACIL"),
        acil: sayOncelik("ACIL"),
      };
    })
    .filter((d) => d.toplam > 0)
    .sort((a, b) => b.toplam - a.toplam);

  const typeNameById = new Map(complaintTypes.map((t) => [t.id, t.name]));
  const turKeys = new Set(turDurum.map((g) => g.complaintTypeId));
  const turDagilim = [...turKeys]
    .map((id) => {
      const rows = turDurum.filter((g) => g.complaintTypeId === id);
      const say = (durum: string) =>
        rows.find((g) => g.durum === durum)?._count._all ?? 0;
      return {
        name: id ? (typeNameById.get(id) ?? "—") : "Belirtilmemiş",
        toplam: rows.reduce((a, g) => a + g._count._all, 0),
        acik: say("ACIK"),
        kapatildi: say("KAPATILDI"),
      };
    })
    .filter((t) => t.toplam > 0)
    .sort((a, b) => b.toplam - a.toplam);

  const kanalDagilim = kanalGruplari
    .map((g) => ({ kanal: g.kanal, toplam: g._count._all }))
    .filter((k) => k.toplam > 0)
    .sort((a, b) => b.toplam - a.toplam);

  const mahalleAdiById = new Map(neighborhoods.map((n) => [n.id, n.name]));
  const mahalleDagilim = mahalleGruplari
    .map((g) => ({
      name: g.neighborhoodId
        ? (mahalleAdiById.get(g.neighborhoodId) ?? "—")
        : "Mahalle belirtilmemiş",
      toplam: g._count._all,
    }))
    .filter((m) => m.toplam > 0)
    .sort((a, b) => b.toplam - a.toplam)
    .slice(0, 10);

  // ── Zaman serileri ─────────────────────────────────────────────────────
  const trendMap = new Map<string, { acilan: number; kapanan: number }>();
  for (const row of trendAcilan) {
    const key = row.gun.toISOString().slice(0, 10);
    trendMap.set(key, {
      acilan: row.adet,
      kapanan: trendMap.get(key)?.kapanan ?? 0,
    });
  }
  for (const row of trendKapanan) {
    const key = row.gun.toISOString().slice(0, 10);
    const cur = trendMap.get(key) ?? { acilan: 0, kapanan: 0 };
    trendMap.set(key, { ...cur, kapanan: row.adet });
  }
  const trend = buildDailySeries(range, trendMap, { acilan: 0, kapanan: 0 });

  const maliyetMap = new Map<string, { bakim: number; yakit: number }>();
  for (const row of bakimAylik) {
    const key = row.ay.toISOString().slice(0, 7);
    maliyetMap.set(key, {
      bakim: row.toplam,
      yakit: maliyetMap.get(key)?.yakit ?? 0,
    });
  }
  for (const row of yakitAylik) {
    const key = row.ay.toISOString().slice(0, 7);
    const cur = maliyetMap.get(key) ?? { bakim: 0, yakit: 0 };
    maliyetMap.set(key, { ...cur, yakit: row.toplam });
  }
  const maliyetTrend = [...maliyetMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ay, v]) => ({ ay, ...v }));

  return {
    kpi,
    anlik: {
      acikSikayet,
      devamEdenSikayet,
      cokAcil,
      acil,
      acilSikayet,
      onayBekleyenWhatsApp,
      devamGorev,
      yaklasanMuayene,
      kritikStokToplam: kritikMalzeme + kritikBeton + kritikBitum,
      kritikMalzeme,
      kritikBeton,
      kritikBitum,
      aracOperasyon: Object.fromEntries(
        aracDurum.map((d) => [d.operasyonDurumu, d._count._all]),
      ),
      aracEnvanter: Object.fromEntries(
        envanterDurum.map((d) => [d.envanterDurumu, d._count._all]),
      ),
    },
    trend,
    maliyetTrend,
    mudurlukDagilim,
    turDagilim,
    kanalDagilim,
    mahalleDagilim,
    saatlikYogunluk: saatlikYogunluk.map((r) => ({
      haftaGunu: r.haftagunu,
      saat: r.saat,
      adet: r.adet,
    })),
    sonBakimlar: sonBakimlar.map((b) => ({
      id: b.id,
      plaka: b.vehicle.plaka,
      ad: b.vehicle.ad,
      sonrakiBakimTarihi: b.sonrakiBakimTarihi,
    })),
  };
}

/** Görevler hem talep eden müdürlüğe hem aracın müdürlüğüne bağlı olabilir. */
function taskScope(scope: DeptScope) {
  if (!("departmentId" in scope)) return {};
  return {
    OR: [{ talepEdenDepartmentId: scope.departmentId }, { vehicle: scope }],
  };
}
