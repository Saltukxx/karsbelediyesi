import { prisma } from "@kars/db";
import { PageHeader } from "@/components/ui/PageHeader";
import CleaningMapPanel from "@/components/map/CleaningMapPanel";
import DispatchPanel, {
  type DispatchOneriDto,
} from "@/components/dispatch/DispatchPanel";
import { gerekceOzeti, type DispatchGerekce } from "@/lib/dispatch";
import { ACTION_ROLES, requirePageAccess } from "@/lib/authz";
import { cardCls } from "@/lib/ui";
import type { CleaningRouteDto } from "@/components/map/cleaning-types";

export const dynamic = "force-dynamic";

export default async function TemizlikPage() {
  const session = await requirePageAccess("/temizlik");
  const canEdit = ACTION_ROLES.temizlik.includes(session.user.role);

  const [routes, bekleyenOneriler, sonGorevler] = await Promise.all([
    prisma.cleaningRoute.findMany({
      orderBy: [{ oncelik: "asc" }, { ad: "asc" }],
    }),
    prisma.dispatchJob.findMany({
      where: { tip: "TEMIZLIK", durum: "ONERILDI" },
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: { select: { plaka: true, vehicleType: { select: { name: true } } } },
      },
    }),
    prisma.dispatchJob.findMany({
      where: { tip: "TEMIZLIK", durum: "ATANDI" },
      orderBy: { createdAt: "desc" },
      distinct: ["routeId"],
      select: { routeId: true, createdAt: true },
    }),
  ]);

  const sonGorevByRoute = new Map(
    sonGorevler.map((j) => [j.routeId, j.createdAt.toISOString()]),
  );

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

  const routeDtos: CleaningRouteDto[] = routes.map((r) => ({
    id: r.id,
    ad: r.ad,
    koordinatlar: r.koordinatlar as [number, number][],
    oncelik: r.oncelik,
    aktif: r.aktif,
    notlar: r.notlar,
    sonGorev: sonGorevByRoute.get(r.id) ?? null,
  }));

  const aktifRotalar = routeDtos.filter((r) => r.aktif);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Yol Temizliği"
        description="Süpürme/yıkama güzergahları ve araç ataması. Görev sonrası rota takip raporu Görevlendirme sayfasından açılır."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Aktif rota</div>
          <div className="mt-1 text-2xl font-semibold text-kb-navy">
            {aktifRotalar.length} / {routeDtos.length}
          </div>
          <div className="mt-1 text-xs text-kb-muted">tanımlı rotalar</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Bekleyen öneri</div>
          <div className="mt-1 text-2xl font-semibold text-kb-navy">
            {oneriDtos.length}
          </div>
          <div className="mt-1 text-xs text-kb-muted">dispatch önerisi</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Görev almış rota</div>
          <div className="mt-1 text-2xl font-semibold text-kb-navy">
            {sonGorevByRoute.size}
          </div>
          <div className="mt-1 text-xs text-kb-muted">en az bir atama yapılmış</div>
        </div>
      </div>

      <DispatchPanel tip="TEMIZLIK" oneriler={oneriDtos} canEdit={canEdit} />

      <CleaningMapPanel routes={routeDtos} canEdit={canEdit} />
    </div>
  );
}
