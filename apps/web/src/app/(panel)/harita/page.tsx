import { prisma } from "@kars/db";
import { SIKAYET_DURUM_LABELS } from "@kars/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import RoadMapPanel from "@/components/map/RoadMapPanel";
import RoadMapStats from "@/components/map/RoadMapStats";
import { ACTION_ROLES, requirePageAccess } from "@/lib/authz";
import { KONUM_TAZELIK_MS } from "@/lib/location";
import type {
  AsfaltDurumDto,
  ComplaintPinDto,
  HazardDto,
  HazardTipDto,
  LiveVehicleDto,
  RoadDto,
} from "@/components/map/road-map-types";

export const dynamic = "force-dynamic";

export default async function HaritaPage() {
  const session = await requirePageAccess("/harita");
  const canEdit = ACTION_ROLES.harita.includes(session.user.role);

  const [roadRows, hazardRows, complaintRows, vehicleRows] = await Promise.all([
    prisma.asphaltRoad.findMany({
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.roadHazard.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        photos: { select: { id: true } },
      },
    }),
    prisma.complaint.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      select: {
        id: true,
        sikayetNo: true,
        durum: true,
        lat: true,
        lng: true,
        aciklama: true,
      },
    }),
    prisma.vehicle.findMany({
      where: {
        sonKonumLat: { not: null },
        sonKonumLng: { not: null },
        sonKonumZamani: { gte: new Date(Date.now() - KONUM_TAZELIK_MS) },
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
  }));

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
      <RoadMapPanel
        roads={roads}
        hazards={hazards}
        complaints={complaints}
        liveVehicles={liveVehicles}
        canEdit={canEdit}
      />
    </div>
  );
}
