import Link from "next/link";
import { prisma } from "@kars/db";
import { SIKAYET_DURUM_LABELS } from "@kars/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import RoadMapPanel from "@/components/map/RoadMapPanel";
import RoadMapStats from "@/components/map/RoadMapStats";
import { ACTION_ROLES, departmentScope, requirePageAccess } from "@/lib/authz";
import { KONUM_TAZELIK_MS } from "@/lib/location";
import type {
  AsfaltDurumDto,
  ComplaintPinDto,
  DepartmentOptionDto,
  HazardDto,
  HazardTipDto,
  LiveVehicleDto,
  PersonnelOptionDto,
  RoadDto,
} from "@/components/map/road-map-types";

export const dynamic = "force-dynamic";

/** Isı haritası take:2000 ile uyumlu; açık/aktif kayıtlar öncelikli doldurulur. */
const HARITA_SIKAYET_PIN_LIMIT = 2000;
/** Açık engeller tercih edilir; giderilmişlerle tamamlanır. */
const HARITA_ENGEL_LIMIT = 1000;
/** Planlı/devam asfalt rotaları tercih edilir. */
const HARITA_ASFALT_LIMIT = 500;

async function limitedComplaints(
  dept: ReturnType<typeof departmentScope>,
) {
  const select = {
    id: true,
    sikayetNo: true,
    durum: true,
    lat: true,
    lng: true,
    aciklama: true,
  } as const;
  const base = { lat: { not: null }, lng: { not: null }, ...dept };
  const aktif = await prisma.complaint.findMany({
    where: { ...base, durum: { in: ["ACIK", "DEVAM_EDIYOR"] } },
    select,
    orderBy: { kayitTarihi: "desc" },
    take: HARITA_SIKAYET_PIN_LIMIT,
  });
  if (aktif.length >= HARITA_SIKAYET_PIN_LIMIT) return aktif;
  const kalan = HARITA_SIKAYET_PIN_LIMIT - aktif.length;
  const diger = await prisma.complaint.findMany({
    where: { ...base, durum: { notIn: ["ACIK", "DEVAM_EDIYOR"] } },
    select,
    orderBy: { kayitTarihi: "desc" },
    take: kalan,
  });
  return [...aktif, ...diger];
}

async function limitedHazards(dept: ReturnType<typeof departmentScope>) {
  const include = {
    createdBy: { select: { name: true } },
    photos: { select: { id: true } },
  } as const;
  const aktif = await prisma.roadHazard.findMany({
    where: { ...dept, durum: "ACIK" },
    orderBy: { createdAt: "desc" },
    include,
    take: HARITA_ENGEL_LIMIT,
  });
  if (aktif.length >= HARITA_ENGEL_LIMIT) return aktif;
  const kalan = HARITA_ENGEL_LIMIT - aktif.length;
  const diger = await prisma.roadHazard.findMany({
    where: { ...dept, durum: { not: "ACIK" } },
    orderBy: { createdAt: "desc" },
    include,
    take: kalan,
  });
  return [...aktif, ...diger];
}

async function limitedRoads(dept: ReturnType<typeof departmentScope>) {
  const include = {
    createdBy: { select: { name: true } },
    department: { select: { name: true } },
    personel: { include: { personnel: { select: { id: true, adSoyad: true } } } },
  } as const;
  const aktif = await prisma.asphaltRoad.findMany({
    where: { ...dept, durum: { in: ["PLANLANDI", "DEVAM_EDIYOR"] } },
    orderBy: { createdAt: "desc" },
    include,
    take: HARITA_ASFALT_LIMIT,
  });
  if (aktif.length >= HARITA_ASFALT_LIMIT) return aktif;
  const kalan = HARITA_ASFALT_LIMIT - aktif.length;
  const diger = await prisma.asphaltRoad.findMany({
    where: { ...dept, durum: { notIn: ["PLANLANDI", "DEVAM_EDIYOR"] } },
    orderBy: { createdAt: "desc" },
    include,
    take: kalan,
  });
  return [...aktif, ...diger];
}

export default async function HaritaPage() {
  const session = await requirePageAccess("/harita");
  const canEdit = ACTION_ROLES.harita.includes(session.user.role);
  const dept = departmentScope(session);

  const rol = session.user.role;
  const personelAtayabilir =
    rol === "ADMIN" || (rol === "DEPARTMENT_MANAGER" && !!session.user.departmentId);

  const [roadRows, hazardRows, complaintRows, missingLocRows, vehicleRows, mudurlukRows, personelRows] =
    await Promise.all([
    limitedRoads(dept),
    limitedHazards(dept),
    limitedComplaints(dept),
    prisma.complaint.findMany({
      where: {
        OR: [{ lat: null }, { lng: null }],
        durum: { in: ["ACIK", "DEVAM_EDIYOR"] },
        ...dept,
      },
      select: {
        id: true,
        sikayetNo: true,
        durum: true,
        acikAdres: true,
        arayanKisi: true,
      },
      orderBy: { kayitTarihi: "desc" },
      take: 40,
    }),
    prisma.vehicle.findMany({
      where: {
        sonKonumLat: { not: null },
        sonKonumLng: { not: null },
        sonKonumZamani: { gte: new Date(Date.now() - KONUM_TAZELIK_MS) },
        ...dept,
      },
      select: {
        id: true,
        plaka: true,
        sonKonumLat: true,
        sonKonumLng: true,
        sonKonumZamani: true,
        vehicleType: { select: { name: true } },
      },
    }),
    canEdit
      ? prisma.department.findMany({
          where: { aktif: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    personelAtayabilir
      ? prisma.personnel.findMany({
          where: {
            durum: "AKTIF",
            ...(rol === "DEPARTMENT_MANAGER"
              ? { departmentId: session.user.departmentId }
              : {}),
          },
          orderBy: { adSoyad: "asc" },
          select: { id: true, adSoyad: true, unvan: true },
        })
      : Promise.resolve([]),
  ]);

  const roads: RoadDto[] = roadRows.map((r) => ({
    id: r.id,
    ad: r.ad,
    koordinatlar: r.koordinatlar as [number, number][],
    durum: r.durum as AsfaltDurumDto,
    dokumTarihi: r.dokumTarihi?.toISOString() ?? null,
    notlar: r.notlar,
    olusturan: r.createdBy.name,
    createdAt: r.createdAt.toISOString(),
    departmentId: r.departmentId,
    mudurluk: r.department?.name ?? null,
    personel: r.personel.map((p) => ({
      id: p.personnel.id,
      adSoyad: p.personnel.adSoyad,
    })),
  }));

  const mudurlukler: DepartmentOptionDto[] = mudurlukRows;
  const atanabilirPersonel: PersonnelOptionDto[] = personelRows;

  const hazards: HazardDto[] = hazardRows.map((h) => ({
    id: h.id,
    tip: h.tip as HazardTipDto,
    lat: h.lat,
    lng: h.lng,
    aciklama: h.aciklama,
    durum: h.durum,
    olusturan: h.createdBy.name,
    tarih: h.createdAt.toISOString(),
    photoIds: h.photos.map((p) => p.id),
  }));

  const complaints: ComplaintPinDto[] = complaintRows.map((c) => ({
    id: c.id,
    sikayetNo: c.sikayetNo,
    durum: SIKAYET_DURUM_LABELS[c.durum] ?? c.durum,
    durumKodu: c.durum,
    lat: c.lat as number,
    lng: c.lng as number,
    aciklama: c.aciklama,
  }));

  const liveVehicles: LiveVehicleDto[] = vehicleRows.map((v) => ({
    id: v.id,
    plaka: v.plaka,
    tip: v.vehicleType?.name ?? null,
    lat: v.sonKonumLat as number,
    lng: v.sonKonumLng as number,
    zaman: (v.sonKonumZamani as Date).toISOString(),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Yol Haritası"
        description="Asfalt dökülen yollar, çukur/engel noktaları ve konumu bilinen şikayetler"
      />
      <RoadMapStats roads={roads} hazards={hazards} complaints={complaints} />

      {missingLocRows.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-1 text-sm font-semibold text-amber-950">
            Konumu eksik açık şikayetler ({missingLocRows.length})
          </h2>
          <p className="mb-3 text-xs text-amber-900/80">
            Bu kayıtlar haritada görünmez. Detaydan pin veya adres ile konum ekleyin.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missingLocRows.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/sikayetler/${c.id}`}
                    className="font-mono text-kb-navy hover:underline"
                  >
                    {c.sikayetNo}
                  </Link>
                  <span className="text-xs text-kb-muted">
                    {SIKAYET_DURUM_LABELS[c.durum] ?? c.durum}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-kb-muted">
                  {c.arayanKisi}
                  {c.acikAdres ? ` · ${c.acikAdres}` : ""}
                </p>
                <Link
                  href={`/sikayetler/${c.id}#konum`}
                  className="mt-1 inline-block text-xs font-medium text-kb-navy underline"
                >
                  Konumu güncelle
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RoadMapPanel
        roads={roads}
        hazards={hazards}
        complaints={complaints}
        liveVehicles={liveVehicles}
        canEdit={canEdit}
        mudurlukler={mudurlukler}
        atanabilirPersonel={atanabilirPersonel}
        personelAtayabilir={personelAtayabilir}
        lockedDepartmentId={
          rol === "DEPARTMENT_MANAGER" ? session.user.departmentId : null
        }
      />
    </div>
  );
}
