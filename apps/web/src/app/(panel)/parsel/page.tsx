import { prisma } from "@kars/db";
import { PageHeader } from "@/components/ui/PageHeader";
import ParcelMapPanel from "@/components/map/ParcelMapPanel";
import { requirePageAccess } from "@/lib/authz";
import type {
  ParcelDto,
  ParcelGeometryDto,
} from "@/components/map/parcel-api";

export const dynamic = "force-dynamic";

export default async function ParselPage() {
  await requirePageAccess("/parsel");

  // Daha önce sorgulanmış parseller sayfa açılışında haritada hazır olsun
  const rows = await prisma.parcel.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const parcels: ParcelDto[] = rows.map((r) => ({
    id: r.id,
    ilAd: r.ilAd,
    ilceAd: r.ilceAd,
    mahalleAd: r.mahalleAd,
    mahalleId: r.mahalleId,
    adaNo: r.adaNo,
    parselNo: r.parselNo,
    alan: r.alan,
    nitelik: r.nitelik,
    mevkii: r.mevkii,
    pafta: r.pafta,
    geometri: r.geometri as unknown as ParcelGeometryDto,
    lat: r.lat,
    lng: r.lng,
    kaynak: "cache",
    sorgulandi: r.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parsel Sorgu"
        description="TKGM kadastro verisiyle ada/parsel sorgulama — haritaya tıklayın veya ada/parsel numarasıyla arayın"
      />
      <ParcelMapPanel initialParcels={parcels} />
    </div>
  );
}
