import Link from "next/link";
import { prisma } from "@kars/db";
import type { Prisma } from "@kars/db";
import {
  ENVANTER_DURUM_LABELS,
  OPERASYON_DURUM_LABELS,
  YAKIT_TIPI_LABELS,
} from "@kars/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StickyFilter } from "@/components/ui/StickyFilter";
import { RowActions, RowActionLink } from "@/components/ui/RowActions";
import { btnPrimary } from "@/lib/ui";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { Pagination, pageSize, parsePage } from "@/components/ui/Pagination";

export const dynamic = "force-dynamic";

function tarihRengi(t: Date | null): string {
  if (!t) return "";
  const gun = (t.getTime() - Date.now()) / 86_400_000;
  if (gun < 0) return "text-red-600 font-semibold";
  if (gun < 30) return "text-amber-600 font-semibold";
  return "";
}

export default async function AraclarPage({
  searchParams,
}: {
  searchParams: Promise<{ ara?: string; durum?: string; cins?: string; page?: string; size?: string }>;
}) {
  const session = await requirePageAccess("/araclar");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const take = pageSize(sp.size, 25);
  const skip = (page - 1) * take;
  const where: Prisma.VehicleWhereInput = { ...departmentScope(session) };
  if (sp.ara)
    where.OR = [
      { plaka: { contains: sp.ara, mode: "insensitive" } },
      { ad: { contains: sp.ara, mode: "insensitive" } },
      { marka: { contains: sp.ara, mode: "insensitive" } },
    ];
  if (sp.durum) where.envanterDurumu = sp.durum as never;
  if (sp.cins) where.vehicleTypeId = sp.cins;

  const [total, araclar, cinsler] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      skip,
      take,
      include: {
        vehicleType: true,
        department: true,
        atananSofor: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { plaka: "asc" },
    }),
    prisma.vehicleType.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Araç & İş Makinesi Envanteri"
        description="Filo envanteri, operasyon durumu ve birim zimmetleri."
        actions={
          <Link href="/araclar/yeni" className={btnPrimary}>
            Yeni Araç
          </Link>
        }
      />

      <StickyFilter>
        <form className="flex flex-wrap gap-2" method="get">
          <input
            name="ara"
            defaultValue={sp.ara ?? ""}
            placeholder="Plaka, ad, marka..."
            className="w-56 rounded-md border border-kb-border px-3 py-1.5 text-sm"
          />
          <select
            name="durum"
            defaultValue={sp.durum ?? ""}
            className="rounded-md border border-kb-border px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Durumlar</option>
            {Object.entries(ENVANTER_DURUM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            name="cins"
            defaultValue={sp.cins ?? ""}
            className="rounded-md border border-kb-border px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Cinsler</option>
            {cinsler.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-kb-navy px-4 py-1.5 text-sm text-white">
            Filtrele
          </button>
        </form>
      </StickyFilter>

      <DataTable
        minWidth="1200px"
        empty={araclar.length === 0}
        emptyTitle="Araç bulunamadı"
        emptyDescription="Filtreleri değiştirin veya yeni araç ekleyin."
        emptyAction={
          <Link href="/araclar/yeni" className={btnPrimary}>
            Yeni Araç
          </Link>
        }
      >
        <thead>
          <tr>
            <th>Plaka / Seri No</th>
            <th>Araç Adı</th>
            <th>Cinsi</th>
            <th>Marka / Model</th>
            <th>Yıl</th>
            <th>Yakıt</th>
            <th>Sayaç</th>
            <th>Muayene</th>
            <th>Sigorta</th>
            <th>Sonraki Bakım</th>
            <th>Birim</th>
            <th>Şoför</th>
            <th>Envanter</th>
            <th>Operasyon</th>
            <th>Görev</th>
            <th className="!text-right">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {araclar.map((a) => (
            <tr key={a.id} className="group">
              <td className="font-mono">
                <Link href={`/araclar/${a.id}`} className="text-kb-navy hover:underline">
                  {a.plaka}
                </Link>
              </td>
              <td>{a.ad ?? "—"}</td>
              <td>{a.vehicleType?.name ?? "—"}</td>
              <td>{[a.marka, a.model].filter(Boolean).join(" ") || "—"}</td>
              <td>{a.modelYili ?? "—"}</td>
              <td>{a.yakitTipi ? YAKIT_TIPI_LABELS[a.yakitTipi] : "—"}</td>
              <td>
                {a.sayacDeger != null
                  ? `${a.sayacDeger.toLocaleString("tr-TR")} ${a.sayacBirim}`
                  : "—"}
              </td>
              <td className={tarihRengi(a.muayeneTarihi)}>
                {a.muayeneTarihi?.toLocaleDateString("tr-TR") ?? "—"}
              </td>
              <td className={tarihRengi(a.sigortaBitis)}>
                {a.sigortaBitis?.toLocaleDateString("tr-TR") ?? "—"}
              </td>
              <td className={tarihRengi(a.sonrakiBakimTarihi)}>
                {a.sonrakiBakimTarihi?.toLocaleDateString("tr-TR") ?? "—"}
              </td>
              <td>{a.department?.shortName ?? "—"}</td>
              <td>{a.atananSofor?.name ?? "—"}</td>
              <td>
                <StatusBadge label={ENVANTER_DURUM_LABELS[a.envanterDurumu]} />
              </td>
              <td>
                <StatusBadge label={OPERASYON_DURUM_LABELS[a.operasyonDurumu]} />
              </td>
              <td className="text-center">{a._count.tasks}</td>
              <td>
                <RowActions>
                  <RowActionLink href={`/araclar/${a.id}`}>Detay</RowActionLink>
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <p className="text-xs text-kb-muted">
        Kırmızı: tarihi geçmiş · Turuncu: 30 gün içinde — muayene/sigorta/bakım uyarıları
      </p>
      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / take))}
        basePath="/araclar"
        searchParams={{ ara: sp.ara, durum: sp.durum, cins: sp.cins, size: sp.size }}
      />
    </div>
  );
}
