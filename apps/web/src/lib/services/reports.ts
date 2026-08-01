import { z } from "zod";
import { prisma } from "@kars/db";
import { toplamOperasyonMaliyeti } from "@kars/shared";
import {
  ACTION_ROLES,
  departmentScope,
  EXPORT_ENTITY_ROLES,
} from "@/lib/authz";
import { computeSlaSummary, type SlaSummary } from "@/lib/sla";
import { gorevMaliyetleri, type GorevMaliyet } from "@/lib/task-cost";
import { rolGerekli, type ServiceActor } from "@/lib/services/base";

/** Mahalle analizinin varsayılan penceresi (gün) */
const MAHALLE_GUN = 90;
/** İş maliyeti raporunun varsayılan penceresi (gün) */
const MALIYET_GUN = 30;
/** Maliyet tablosunda gösterilen azami görev sayısı */
const MALIYET_LIMIT = 200;

const GUN_MS = 24 * 60 * 60 * 1000;

export const gunSorguSchema = z.object({
  gun: z.coerce.number().int().min(1).max(365).optional(),
});

type DeptScope = { departmentId?: string | { in: string[] } };

// MARK: - Genel özet

export interface RaporOzetiDTO {
  sla: SlaSummary;
  toplamSikayet: number;
  toplamArac: number;
  toplamGorev: number;
  yakitBakimToplam: number;
}

/** Raporlar ekranının SLA bölümü ve alt özet kartları */
export async function raporOzeti(actor: ServiceActor): Promise<RaporOzetiDTO> {
  rolGerekli(actor, ACTION_ROLES.reports);
  const dept = departmentScope(actor);

  const [sla, sikayet, arac, gorev, yakit, bakim] = await Promise.all([
    computeSlaSummary(actor),
    prisma.complaint.count({ where: dept }),
    prisma.vehicle.count({ where: dept }),
    prisma.vehicleTask.count({ where: gorevKapsami(dept) }),
    prisma.fuelRecord.aggregate({
      where: aracKapsami(dept),
      _sum: { tutar: true },
    }),
    prisma.maintenanceRecord.aggregate({
      where: aracKapsami(dept),
      _sum: { maliyet: true },
    }),
  ]);

  return {
    sla,
    toplamSikayet: sikayet,
    toplamArac: arac,
    toplamGorev: gorev,
    yakitBakimToplam: toplamOperasyonMaliyeti(
      Number(bakim._sum.maliyet ?? 0),
      Number(yakit._sum.tutar ?? 0),
    ),
  };
}

/** Görevler hem talep eden müdürlüğe hem aracın müdürlüğüne bağlı olabilir. */
function gorevKapsami(dept: DeptScope) {
  if (!dept.departmentId) return undefined;
  return {
    OR: [
      { talepEdenDepartmentId: dept.departmentId },
      { vehicle: { departmentId: dept.departmentId } },
    ],
  };
}

function aracKapsami(dept: DeptScope) {
  return dept.departmentId ? { vehicle: { departmentId: dept.departmentId } } : undefined;
}

// MARK: - Mahalle analizi

export interface MahalleSatiriDTO {
  ad: string;
  toplam: number;
  acik: number;
  kapanan: number;
  /** Kapanan şikayetlerin ortalama çözüm süresi (gün) */
  ortCozumGun: number | null;
  enSikTip: string;
}

/** Verilen pencerede şikayetlerin mahalle bazlı kırılımı */
export async function mahalleAnalizi(
  actor: ServiceActor,
  input?: unknown,
): Promise<MahalleSatiriDTO[]> {
  rolGerekli(actor, ACTION_ROLES.reports);
  const { gun } = gunSorguSchema.parse(input ?? {});
  const since = new Date(Date.now() - (gun ?? MAHALLE_GUN) * GUN_MS);

  const complaints = await prisma.complaint.findMany({
    where: { ...departmentScope(actor), kayitTarihi: { gte: since } },
    select: {
      durum: true,
      createdAt: true,
      kapanisTarihi: true,
      neighborhood: { select: { name: true } },
      complaintType: { select: { name: true } },
    },
  });

  interface Birikim {
    toplam: number;
    acik: number;
    kapanan: number;
    cozumGunler: number[];
    tipler: Map<string, number>;
  }

  const byMahalle = new Map<string, Birikim>();
  for (const c of complaints) {
    const ad = c.neighborhood?.name ?? "Mahalle belirtilmemiş";
    let row = byMahalle.get(ad);
    if (!row) {
      row = { toplam: 0, acik: 0, kapanan: 0, cozumGunler: [], tipler: new Map() };
      byMahalle.set(ad, row);
    }
    row.toplam += 1;
    if (c.durum === "KAPATILDI") {
      row.kapanan += 1;
      if (c.kapanisTarihi) {
        row.cozumGunler.push((c.kapanisTarihi.getTime() - c.createdAt.getTime()) / GUN_MS);
      }
    } else if (c.durum !== "IPTAL") {
      row.acik += 1;
    }
    const tip = c.complaintType?.name ?? "Belirsiz";
    row.tipler.set(tip, (row.tipler.get(tip) ?? 0) + 1);
  }

  return Array.from(byMahalle.entries())
    .map(([ad, r]) => ({
      ad,
      toplam: r.toplam,
      acik: r.acik,
      kapanan: r.kapanan,
      ortCozumGun: ortalamaGun(r.cozumGunler),
      enSikTip: Array.from(r.tipler.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
    }))
    // En yavaş çözülen mahalle başta
    .sort((a, b) => (b.ortCozumGun ?? -1) - (a.ortCozumGun ?? -1));
}

function ortalamaGun(gunler: number[]): number | null {
  if (gunler.length === 0) return null;
  const ortalama = gunler.reduce((a, b) => a + b, 0) / gunler.length;
  return Math.round(ortalama * 10) / 10;
}

// MARK: - İş maliyeti

export interface MaliyetSatiriDTO {
  id: string;
  gorevNo: string;
  plaka: string;
  gorevTanimi: string | null;
  mudurluk: string;
  maliyet: GorevMaliyet;
}

export interface MudurlukToplamiDTO {
  mudurluk: string;
  toplam: number;
}

export interface IsMaliyetiDTO {
  satirlar: MaliyetSatiriDTO[];
  mudurlukToplamlari: MudurlukToplamiDTO[];
}

const SIFIR_MALIYET: GorevMaliyet = {
  yakit: 0,
  yakitTahmini: false,
  malzeme: 0,
  iscilik: 0,
  diger: 0,
  toplam: 0,
};

/** Verilen pencerede kapanan görevlerin maliyet kırılımı */
export async function isMaliyetiRaporu(
  actor: ServiceActor,
  input?: unknown,
): Promise<IsMaliyetiDTO> {
  rolGerekli(actor, ACTION_ROLES.reports);
  const { gun } = gunSorguSchema.parse(input ?? {});
  const since = new Date(Date.now() - (gun ?? MALIYET_GUN) * GUN_MS);
  const dept = departmentScope(actor);

  const tasks = await prisma.vehicleTask.findMany({
    where: {
      durum: "TAMAMLANDI",
      girisTarihi: { gte: since },
      ...(gorevKapsami(dept) ?? {}),
    },
    orderBy: { girisTarihi: "desc" },
    take: MALIYET_LIMIT,
    select: {
      id: true,
      gorevNo: true,
      gorevTanimi: true,
      sureSaat: true,
      kmFarki: true,
      driverId: true,
      vehicleId: true,
      maliyet: true,
      vehicle: { select: { plaka: true, normTuketim: true } },
      talepEdenDepartment: { select: { shortName: true, name: true } },
    },
  });

  const maliyetler = await gorevMaliyetleri(
    tasks.map((t) => ({
      id: t.id,
      sureSaat: t.sureSaat,
      kmFarki: t.kmFarki,
      driverId: t.driverId,
      vehicleId: t.vehicleId,
      normTuketim: t.vehicle.normTuketim,
      manuelMaliyet: t.maliyet != null ? Number(t.maliyet) : null,
    })),
  );

  const satirlar = tasks.map((t) => ({
    id: t.id,
    gorevNo: t.gorevNo,
    plaka: t.vehicle.plaka,
    gorevTanimi: t.gorevTanimi,
    mudurluk: t.talepEdenDepartment?.shortName || t.talepEdenDepartment?.name || "—",
    maliyet: maliyetler.get(t.id) ?? SIFIR_MALIYET,
  }));

  const toplamlar = new Map<string, number>();
  for (const s of satirlar) {
    toplamlar.set(s.mudurluk, (toplamlar.get(s.mudurluk) ?? 0) + s.maliyet.toplam);
  }

  return {
    satirlar,
    mudurlukToplamlari: Array.from(toplamlar.entries())
      .map(([mudurluk, toplam]) => ({ mudurluk, toplam }))
      .sort((a, b) => b.toplam - a.toplam),
  };
}

// MARK: - Export kataloğu

export interface ExportKalemiDTO {
  entity: string;
  baslik: string;
  /** Web'deki ilgili liste sayfası; mobilde ilgili ekrana yönlendirmek için */
  href: string;
  /** Kullanıcının rolü bu dosyayı indirebiliyor mu */
  izinli: boolean;
  /** Dosyanın `from`/`to` parametrelerini dikkate alıp almadığı */
  tarihFiltreli: boolean;
}

/** Raporlar sayfasındaki Excel listesi; web ile aynı sıra ve etiketler. */
const EXPORT_KALEMLERI: ReadonlyArray<Omit<ExportKalemiDTO, "izinli">> = [
  { entity: "sikayetler", baslik: "Şikayetler", href: "/sikayetler", tarihFiltreli: true },
  { entity: "araclar", baslik: "Araç Envanteri", href: "/araclar", tarihFiltreli: false },
  { entity: "bakim", baslik: "Bakım Takip", href: "/bakim", tarihFiltreli: true },
  { entity: "yakit", baslik: "Yakıt Takip", href: "/yakit", tarihFiltreli: true },
  { entity: "gorevler", baslik: "Görevlendirme", href: "/gorevler", tarihFiltreli: true },
  { entity: "personel", baslik: "Personel", href: "/personel", tarihFiltreli: false },
  {
    entity: "akaryakit",
    baslik: "Akaryakıt Analizi",
    href: "/akaryakit",
    tarihFiltreli: false,
  },
  { entity: "malzeme", baslik: "Malzeme Depo", href: "/malzeme-depo", tarihFiltreli: false },
  { entity: "beton", baslik: "Beton Reçeteleri", href: "/beton", tarihFiltreli: false },
  { entity: "bitum", baslik: "Bitüm Hareket", href: "/bitum", tarihFiltreli: false },
];

export function exportKatalogu(actor: ServiceActor): ExportKalemiDTO[] {
  rolGerekli(actor, ACTION_ROLES.reports);
  return EXPORT_KALEMLERI.map((kalem) => ({
    ...kalem,
    izinli: (EXPORT_ENTITY_ROLES[kalem.entity] ?? []).includes(actor.user.role),
  }));
}
