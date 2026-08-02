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
import { btnPrimary, btnSecondary, inputCls } from "@/lib/ui";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { Pagination, pageSize, parsePage } from "@/components/ui/Pagination";
import { SortableTh } from "@/components/ui/SortableTh";
import { orderByFor, parseSort, SORT_PARAM, type SortDir } from "@/lib/sort";

export const dynamic = "force-dynamic";

const SIRALAMA = {
  plaka: (dir: SortDir) => [{ plaka: dir }],
  ad: (dir: SortDir) => [{ ad: dir }],
  cins: (dir: SortDir) => [{ vehicleType: { name: dir } }],
  modelYili: (dir: SortDir) => [{ modelYili: dir }],
  muayene: (dir: SortDir) => [{ muayeneTarihi: dir }],
  sigorta: (dir: SortDir) => [{ sigortaBitis: dir }],
  bakim: (dir: SortDir) => [{ sonrakiBakimTarihi: dir }],
  birim: (dir: SortDir) => [{ department: { name: dir } }],
  envanter: (dir: SortDir) => [{ envanterDurumu: dir }],
  operasyon: (dir: SortDir) => [{ operasyonDurumu: dir }],
  gorev: (dir: SortDir) => [{ tasks: { _count: dir } }],
} satisfies Record<string, (dir: SortDir) => Prisma.VehicleOrderByWithRelationInput[]>;

const SIRALANABILIR = Object.keys(SIRALAMA) as Array<keyof typeof SIRALAMA>;

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
  searchParams: Promise<{
    ara?: string;
    durum?: string;
    cins?: string;
    page?: string;
    size?: string;
    sirala?: string;
  }>;
}) {
  const session = await requirePageAccess("/araclar");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const take = pageSize(sp.size, 25);
  const skip = (page - 1) * take;
  const sirala = parseSort(sp.sirala, SIRALANABILIR, { key: "plaka", dir: "asc" });
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
      orderBy: orderByFor(sirala, SIRALAMA),
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
        {/* Sıralama ve sayfa boyutu gizli alanlarla korunur */}
        <form className="flex flex-wrap items-end gap-2" method="get">
          <input type="hidden" name={SORT_PARAM} value={`${sirala.key}:${sirala.dir}`} />
          {sp.size && <input type="hidden" name="size" value={sp.size} />}
          <input
            name="ara"
            defaultValue={sp.ara ?? ""}
            placeholder="Plaka, ad, marka..."
            aria-label="Araçlarda ara"
            className={`${inputCls} w-56`}
          />
          <select
            name="durum"
            defaultValue={sp.durum ?? ""}
            aria-label="Envanter durumu filtresi"
            className={`${inputCls} w-auto`}
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
            aria-label="Araç cinsi filtresi"
            className={`${inputCls} w-auto`}
          >
            <option value="">Tüm Cinsler</option>
            {cinsler.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className={btnPrimary}>Filtrele</button>
          {(sp.ara || sp.durum || sp.cins) && (
            <Link href="/araclar" className={btnSecondary}>
              Temizle
            </Link>
          )}
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
            <SortableTh sortKey="plaka" current={sirala}>
              Plaka / Seri No
            </SortableTh>
            <SortableTh sortKey="ad" current={sirala}>
              Araç Adı
            </SortableTh>
            <SortableTh sortKey="cins" current={sirala}>
              Cinsi
            </SortableTh>
            <th>Marka / Model</th>
            <SortableTh sortKey="modelYili" current={sirala} defaultDir="desc">
              Yıl
            </SortableTh>
            <th>Yakıt</th>
            <th>Sayaç</th>
            <SortableTh sortKey="muayene" current={sirala}>
              Muayene
            </SortableTh>
            <SortableTh sortKey="sigorta" current={sirala}>
              Sigorta
            </SortableTh>
            <SortableTh sortKey="bakim" current={sirala}>
              Sonraki Bakım
            </SortableTh>
            <SortableTh sortKey="birim" current={sirala}>
              Birim
            </SortableTh>
            <th>Şoför</th>
            <SortableTh sortKey="envanter" current={sirala}>
              Envanter
            </SortableTh>
            <SortableTh sortKey="operasyon" current={sirala}>
              Operasyon
            </SortableTh>
            <SortableTh sortKey="gorev" current={sirala} defaultDir="desc">
              Görev
            </SortableTh>
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
        searchParams={{
          ara: sp.ara,
          durum: sp.durum,
          cins: sp.cins,
          size: sp.size,
          [SORT_PARAM]: sp.sirala,
        }}
      />
    </div>
  );
}
