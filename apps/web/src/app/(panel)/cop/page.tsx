import { prisma } from "@kars/db";
import { PageHeader } from "@/components/ui/PageHeader";
import WasteMapPanel from "@/components/map/WasteMapPanel";
import DispatchPanel, {
  type DispatchOneriDto,
} from "@/components/dispatch/DispatchPanel";
import { gerekceOzeti, type DispatchGerekce } from "@/lib/dispatch";
import { ACTION_ROLES, requirePageAccess } from "@/lib/authz";
import { cardCls } from "@/lib/ui";
import { copDurumu, type WasteRouteDto } from "@/components/map/waste-types";

export const dynamic = "force-dynamic";

/** Çöp kamyonu önce gelsin */
function copAraciSirasi(tip: string | null | undefined): number {
  if (!tip) return 2;
  return /[çc][öo]p|hidrolik|s[ıi]k[ıi][şs]t[ıi]rma/i.test(tip) ? 0 : 1;
}

export default async function CopPage() {
  const session = await requirePageAccess("/cop");
  const canEdit = ACTION_ROLES.cop.includes(session.user.role);

  const [routes, vehicles, drivers, bekleyenOneriler] = await Promise.all([
    prisma.wasteRoute.findMany({
      orderBy: [{ oncelik: "asc" }, { ad: "asc" }],
      include: {
        collections: {
          orderBy: { baslangic: "desc" },
          take: 5,
          include: {
            vehicle: { select: { plaka: true } },
            driver: { select: { name: true } },
          },
        },
      },
    }),
    prisma.vehicle.findMany({
      where: { envanterDurumu: { not: "HURDAYA_AYRILDI" } },
      orderBy: { plaka: "asc" },
      select: {
        id: true,
        plaka: true,
        ad: true,
        vehicleType: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["DRIVER", "FIELD_WORKER"] }, aktif: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.dispatchJob.findMany({
      where: { tip: "COP", durum: "ONERILDI" },
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: { select: { plaka: true, vehicleType: { select: { name: true } } } },
      },
    }),
  ]);

  const oneriDtos: DispatchOneriDto[] = bekleyenOneriler.map((j) => ({
    jobId: j.id,
    routeAd: j.routeAd,
    plaka: j.vehicle?.plaka ?? null,
    aracTip: j.vehicle?.vehicleType?.name ?? null,
    mesafeKm: j.mesafeKm,
    sureDk: j.sureDk,
    tahmini: j.tahmini,
    gerekceOzet: gerekceOzeti(j.gerekce as DispatchGerekce | null),
    createdAt: j.createdAt.toISOString(),
  }));

  const routeDtos: WasteRouteDto[] = routes.map((r) => ({
    id: r.id,
    ad: r.ad,
    koordinatlar: r.koordinatlar as [number, number][],
    gunler: (r.gunler as number[]) ?? [],
    oncelik: r.oncelik,
    aktif: r.aktif,
    notlar: r.notlar,
    sonToplama: r.collections[0]?.baslangic.toISOString() ?? null,
    sonToplamalar: r.collections.map((o) => ({
      id: o.id,
      baslangic: o.baslangic.toISOString(),
      bitis: o.bitis?.toISOString() ?? null,
      arac: o.vehicle?.plaka ?? null,
      sofor: o.driver?.name ?? null,
      notlar: o.notlar,
    })),
  }));

  const vehicleDtos = vehicles
    .map((v) => ({
      id: v.id,
      plaka: v.plaka,
      ad: v.ad,
      tip: v.vehicleType?.name ?? null,
    }))
    .sort((a, b) => copAraciSirasi(a.tip) - copAraciSirasi(b.tip));

  // Gün özeti
  const now = Date.now();
  const aktifRotalar = routeDtos.filter((r) => r.aktif);
  const bugunkuler = aktifRotalar.filter((r) => copDurumu(r, now) !== "gunuDegil");
  const toplananlar = bugunkuler.filter((r) => copDurumu(r, now) === "toplandi");
  const bekleyenler = bugunkuler.filter((r) => copDurumu(r, now) === "bekliyor");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Çöp Toplama"
        description="Toplama güzergahları, gün planı ve toplama kayıtları."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Bugün planlı rota</div>
          <div className="mt-1 text-2xl font-semibold text-kb-navy">
            {bugunkuler.length} / {aktifRotalar.length}
          </div>
          <div className="mt-1 text-xs text-kb-muted">aktif rotalar</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Bugün toplanan</div>
          <div className="mt-1 text-2xl font-semibold text-kb-navy">
            {toplananlar.length}
          </div>
          <div className="mt-1 text-xs text-kb-muted">rota tamamlandı</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Bekleyen</div>
          <div
            className={`mt-1 text-2xl font-semibold ${
              bekleyenler.length > 0 ? "text-red-600" : "text-kb-navy"
            }`}
          >
            {bekleyenler.length}
          </div>
          <div className="mt-1 text-xs text-kb-muted">
            {bekleyenler.length > 0
              ? bekleyenler.map((r) => r.ad).slice(0, 3).join(", ")
              : "bugünün rotaları tamam"}
          </div>
        </div>
      </div>

      <DispatchPanel tip="COP" oneriler={oneriDtos} canEdit={canEdit} />

      <WasteMapPanel
        routes={routeDtos}
        vehicles={vehicleDtos}
        drivers={drivers}
        canEdit={canEdit}
      />
    </div>
  );
}
