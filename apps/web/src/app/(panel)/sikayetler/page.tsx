import Link from "next/link";
import { prisma } from "@kars/db";
import type { Prisma } from "@kars/db";
import {
  ONCELIK_LABELS,
  SIKAYET_DURUM_LABELS,
  KANAL_LABELS,
} from "@kars/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StickyFilter } from "@/components/ui/StickyFilter";
import { RowActions, RowActionLink } from "@/components/ui/RowActions";
import { Pagination, pageSize, parsePage } from "@/components/ui/Pagination";
import { SortableTh } from "@/components/ui/SortableTh";
import { Tabs } from "@/components/ui/Tabs";
import { btnPrimary, btnSecondary, inputCls } from "@/lib/ui";
import { orderByFor, parseSort, SORT_PARAM, type SortDir } from "@/lib/sort";
import { departmentScope, requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const SIRALAMA = {
  sikayetNo: (dir: SortDir) => [{ yil: dir }, { sira: dir }],
  kayitTarihi: (dir: SortDir) => [{ kayitTarihi: dir }],
  arayanKisi: (dir: SortDir) => [{ arayanKisi: dir }],
  mahalle: (dir: SortDir) => [{ neighborhood: { name: dir } }],
  tur: (dir: SortDir) => [{ complaintType: { name: dir } }],
  mudurluk: (dir: SortDir) => [{ department: { name: dir } }],
  oncelik: (dir: SortDir) => [{ oncelik: dir }],
  durum: (dir: SortDir) => [{ durum: dir }],
} satisfies Record<string, (dir: SortDir) => Prisma.ComplaintOrderByWithRelationInput[]>;

const SIRALANABILIR = Object.keys(SIRALAMA) as Array<keyof typeof SIRALAMA>;

export default async function SikayetlerPage({
  searchParams,
}: {
  searchParams: Promise<{
    sekme?: string;
    mudurluk?: string;
    tur?: string;
    ara?: string;
    page?: string;
    size?: string;
    sirala?: string;
  }>;
}) {
  const session = await requirePageAccess("/sikayetler");
  const sp = await searchParams;
  const sekme = sp.sekme ?? "aktif";
  const page = parsePage(sp.page);
  const take = pageSize(sp.size, 25);
  const skip = (page - 1) * take;
  const sirala = parseSort(sp.sirala, SIRALANABILIR, {
    key: "sikayetNo",
    dir: "desc",
  });

  const where: Prisma.ComplaintWhereInput = {};
  if (sekme === "aktif") where.durum = { in: ["ACIK", "DEVAM_EDIYOR"] };
  if (sekme === "kapali") where.durum = "KAPATILDI";
  if (sp.mudurluk) where.departmentId = sp.mudurluk;
  if (sp.tur) where.complaintTypeId = sp.tur;
  if (sp.ara)
    where.OR = [
      { sikayetNo: { contains: sp.ara, mode: "insensitive" } },
      { arayanKisi: { contains: sp.ara, mode: "insensitive" } },
      { telefon: { contains: sp.ara } },
      { acikAdres: { contains: sp.ara, mode: "insensitive" } },
    ];
  Object.assign(where, departmentScope(session));

  const [total, sikayetler, mudurlukler, turler] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      orderBy: orderByFor(sirala, SIRALAMA),
      skip,
      take,
      include: {
        neighborhood: true,
        complaintType: true,
        department: true,
        vehicle: true,
        personel: { include: { personnel: true } },
        onaylayan: true,
      },
    }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.complaintType.findMany({ where: { aktif: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / take));

  const sekmeler = [
    { id: "aktif", label: "Aktif İşler" },
    { id: "kapali", label: "Kapalı İşler" },
    { id: "tumu", label: "Tümü" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Şikayet Kayıt & Takip"
        description="Aktif ve kapalı işler, müdürlük yönlendirmesi ve öncelik takibi."
        actions={
          <>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/export/sikayetler" className={btnSecondary}>
              Excel
            </a>
            <Link href="/sikayetler/yeni" className={btnPrimary}>
              Yeni Şikayet
            </Link>
          </>
        }
      />

      <Tabs tabs={sekmeler} param="sekme" defaultTab="aktif" />

      <StickyFilter>
        {/* Sekme, sıralama ve sayfa boyutu gizli alanlarla korunur */}
        <form className="flex flex-wrap items-end gap-2" method="get">
          <input type="hidden" name="sekme" value={sekme} />
          <input type="hidden" name={SORT_PARAM} value={`${sirala.key}:${sirala.dir}`} />
          {sp.size && <input type="hidden" name="size" value={sp.size} />}
          <input
            name="ara"
            defaultValue={sp.ara ?? ""}
            placeholder="Şikayet no, ad, telefon, adres..."
            aria-label="Şikayetlerde ara"
            className={`${inputCls} w-64`}
          />
          <select
            name="mudurluk"
            defaultValue={sp.mudurluk ?? ""}
            aria-label="Müdürlük filtresi"
            className={`${inputCls} w-auto`}
          >
            <option value="">Tüm Müdürlükler</option>
            {mudurlukler.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            name="tur"
            defaultValue={sp.tur ?? ""}
            aria-label="Şikayet türü filtresi"
            className={`${inputCls} w-auto`}
          >
            <option value="">Tüm Türler</option>
            {turler.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className={btnPrimary}>Filtrele</button>
          {(sp.ara || sp.mudurluk || sp.tur) && (
            <Link href={`/sikayetler?sekme=${sekme}`} className={btnSecondary}>
              Temizle
            </Link>
          )}
        </form>
      </StickyFilter>

      <p className="text-xs text-kb-muted" aria-live="polite">
        {total.toLocaleString("tr-TR")} kayıt bulundu
        {total > take && ` · ${skip + 1}–${Math.min(skip + take, total)} arası gösteriliyor`}
      </p>

      <DataTable
        minWidth="1100px"
        empty={sikayetler.length === 0}
        emptyTitle="Şikayet bulunamadı"
        emptyDescription="Filtreleri değiştirin veya yeni kayıt oluşturun."
        emptyAction={
          <Link href="/sikayetler/yeni" className={btnPrimary}>
            Yeni Şikayet
          </Link>
        }
      >
        <thead>
          <tr>
            <SortableTh sortKey="sikayetNo" current={sirala} defaultDir="desc">
              Şikayet No
            </SortableTh>
            <SortableTh sortKey="kayitTarihi" current={sirala} defaultDir="desc">
              Tarih
            </SortableTh>
            <SortableTh sortKey="arayanKisi" current={sirala}>
              Arayan
            </SortableTh>
            <SortableTh sortKey="mahalle" current={sirala}>
              Mahalle
            </SortableTh>
            <SortableTh sortKey="tur" current={sirala}>
              Tür
            </SortableTh>
            <SortableTh sortKey="mudurluk" current={sirala}>
              Müdürlük
            </SortableTh>
            <th>Plaka</th>
            <th>Personel</th>
            <th>Kanal</th>
            <SortableTh sortKey="oncelik" current={sirala} defaultDir="desc">
              Öncelik
            </SortableTh>
            <SortableTh sortKey="durum" current={sirala}>
              Durum
            </SortableTh>
            {sekme === "kapali" && <th>Onaylayan</th>}
            <th className="!text-right">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {sikayetler.map((s) => (
            <tr key={s.id} className="group">
              <td className="font-mono">
                <Link href={`/sikayetler/${s.id}`} className="text-kb-navy hover:underline">
                  {s.sikayetNo}
                </Link>
              </td>
              <td className="whitespace-nowrap">
                {s.kayitTarihi.toLocaleDateString("tr-TR")}{" "}
                <span className="text-kb-muted">
                  {s.kayitTarihi.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </td>
              <td>{s.arayanKisi}</td>
              <td>{s.neighborhood?.name ?? "—"}</td>
              <td>{s.complaintType?.name ?? "—"}</td>
              <td>{s.department?.name ?? "—"}</td>
              <td className="font-mono">{s.vehicle?.plaka ?? "—"}</td>
              <td>{s.personel.map((p) => p.personnel.adSoyad).join(", ") || "—"}</td>
              <td>{KANAL_LABELS[s.kanal]}</td>
              <td>
                <StatusBadge label={ONCELIK_LABELS[s.oncelik]} />
              </td>
              <td>
                <StatusBadge label={SIKAYET_DURUM_LABELS[s.durum]} />
              </td>
              {sekme === "kapali" && <td>{s.onaylayan?.name ?? "—"}</td>}
              <td>
                <RowActions>
                  <RowActionLink href={`/sikayetler/${s.id}`}>Detay</RowActionLink>
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/sikayetler"
        searchParams={{
          sekme,
          mudurluk: sp.mudurluk,
          tur: sp.tur,
          ara: sp.ara,
          size: sp.size,
          [SORT_PARAM]: sp.sirala,
        }}
      />
    </div>
  );
}
