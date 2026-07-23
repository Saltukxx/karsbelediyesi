import { prisma } from "@kars/db";
import { mevcutStok } from "@kars/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import WinterMapPanel from "@/components/map/WinterMapPanel";
import DispatchPanel, {
  type DispatchOneriDto,
} from "@/components/dispatch/DispatchPanel";
import { gerekceOzeti, type DispatchGerekce } from "@/lib/dispatch";
import { ACTION_ROLES, requirePageAccess } from "@/lib/authz";
import { cardCls } from "@/lib/ui";
import type {
  WinterMaterialDto,
  WinterRouteDto,
} from "@/components/map/winter-types";

export const dynamic = "force-dynamic";

/** Kar aracı / tuzlama aracı önce gelsin */
function karAraciSirasi(tip: string | null | undefined): number {
  if (!tip) return 2;
  return /kar|tuz|grey|küre/i.test(tip) ? 0 : 1;
}

export default async function KisPage() {
  const session = await requirePageAccess("/kis");
  const canEdit = ACTION_ROLES.kis.includes(session.user.role);

  const [routes, vehicles, drivers, materials, stokSums, bekleyenOneriler] = await Promise.all([
    prisma.winterRoute.findMany({
      orderBy: [{ oncelik: "asc" }, { ad: "asc" }],
      include: {
        operations: {
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
    prisma.material.findMany({
      where: { aktif: true },
      orderBy: { kod: "asc" },
    }),
    prisma.materialMovement.groupBy({
      by: ["materialId", "tip"],
      _sum: { miktar: true },
    }),
    prisma.dispatchJob.findMany({
      where: { tip: "KIS", durum: "ONERILDI" },
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

  const routeDtos: WinterRouteDto[] = routes.map((r) => ({
    id: r.id,
    ad: r.ad,
    koordinatlar: r.koordinatlar as [number, number][],
    tip: r.tip,
    oncelik: r.oncelik,
    aktif: r.aktif,
    notlar: r.notlar,
    sonOperasyon: r.operations[0]?.baslangic.toISOString() ?? null,
    sonOperasyonlar: r.operations.map((o) => ({
      id: o.id,
      tip: o.tip,
      baslangic: o.baslangic.toISOString(),
      bitis: o.bitis?.toISOString() ?? null,
      tuzKg: o.tuzKg != null ? Number(o.tuzKg) : null,
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
    .sort((a, b) => karAraciSirasi(a.tip) - karAraciSirasi(b.tip));

  // Tuz/solüsyon malzemeleri önce, güncel stoklarıyla
  const stokOf = (materialId: string) => {
    const giris = Number(
      stokSums.find((s) => s.materialId === materialId && s.tip === "GIRIS")?._sum
        .miktar ?? 0,
    );
    const cikis = Number(
      stokSums.find((s) => s.materialId === materialId && s.tip === "CIKIS")?._sum
        .miktar ?? 0,
    );
    return mevcutStok(giris, cikis);
  };
  const tuzMu = (m: { ad: string; kategori: string }) =>
    /tuz|sol[uü]syon/i.test(`${m.ad} ${m.kategori}`);
  const materialDtos: WinterMaterialDto[] = materials
    .map((m) => ({
      id: m.id,
      kod: m.kod,
      ad: m.ad,
      birim: m.birim,
      stok: stokOf(m.id),
    }))
    .sort((a, b) => {
      const ma = materials.find((m) => m.id === a.id)!;
      const mb = materials.find((m) => m.id === b.id)!;
      return Number(tuzMu(mb)) - Number(tuzMu(ma));
    });

  // Sezon özeti
  const now = Date.now();
  const bugunBasi = new Date();
  bugunBasi.setHours(0, 0, 0, 0);
  const aktifRotalar = routeDtos.filter((r) => r.aktif);
  const bugunIslemGoren = aktifRotalar.filter(
    (r) => r.sonOperasyon && new Date(r.sonOperasyon) >= bugunBasi,
  ).length;

  const son24Tuz = await prisma.winterOperation.aggregate({
    where: { baslangic: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
    _sum: { tuzKg: true },
  });

  const kritikRotalar = aktifRotalar.filter(
    (r) =>
      r.oncelik === 1 &&
      (!r.sonOperasyon ||
        now - new Date(r.sonOperasyon).getTime() > 12 * 60 * 60 * 1000),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kış Operasyonu"
        description="Kar küreme / tuzlama rotaları, operasyon kaydı ve tuz stok takibi."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Bugün işlem gören rota</div>
          <div className="mt-1 text-2xl font-semibold text-kb-navy">
            {bugunIslemGoren} / {aktifRotalar.length}
          </div>
          <div className="mt-1 text-xs text-kb-muted">aktif rotalar</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Son 24 saatte kullanılan tuz</div>
          <div className="mt-1 text-2xl font-semibold text-kb-navy">
            {Number(son24Tuz._sum.tuzKg ?? 0).toLocaleString("tr-TR")} kg
          </div>
          <div className="mt-1 text-xs text-kb-muted">tüm rotalar</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">12 saattir dokunulmamış öncelik-1</div>
          <div
            className={`mt-1 text-2xl font-semibold ${
              kritikRotalar.length > 0 ? "text-red-600" : "text-kb-navy"
            }`}
          >
            {kritikRotalar.length}
          </div>
          <div className="mt-1 text-xs text-kb-muted">
            {kritikRotalar.length > 0
              ? kritikRotalar.map((r) => r.ad).slice(0, 3).join(", ")
              : "tüm ana arterler güncel"}
          </div>
        </div>
      </div>

      <DispatchPanel tip="KIS" oneriler={oneriDtos} canEdit={canEdit} />

      <WinterMapPanel
        routes={routeDtos}
        vehicles={vehicleDtos}
        drivers={drivers}
        materials={materialDtos}
        canEdit={canEdit}
      />
    </div>
  );
}
