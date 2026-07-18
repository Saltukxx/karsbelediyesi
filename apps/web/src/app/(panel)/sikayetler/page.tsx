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
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { departmentScope, requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

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
  }>;
}) {
  const session = await requirePageAccess("/sikayetler");
  const sp = await searchParams;
  const sekme = sp.sekme ?? "aktif";
  const page = parsePage(sp.page);
  const take = pageSize(sp.size, 25);
  const skip = (page - 1) * take;

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
      orderBy: [{ yil: "desc" }, { sira: "desc" }],
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
    { key: "aktif", label: "Aktif İşler" },
    { key: "kapali", label: "Kapalı İşler" },
    { key: "tumu", label: "Tümü" },
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

      <div className="flex gap-1 border-b border-kb-border">
        {sekmeler.map((s) => (
          <Link
            key={s.key}
            href={`/sikayetler?sekme=${s.key}`}
            className={`rounded-t-md px-4 py-2 text-sm font-medium ${
              sekme === s.key
                ? "border border-b-0 border-kb-border bg-white text-kb-navy"
                : "text-kb-muted hover:text-kb-ink"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <StickyFilter>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <input type="hidden" name="sekme" value={sekme} />
          <input
            name="ara"
            defaultValue={sp.ara ?? ""}
            placeholder="Şikayet no, ad, telefon, adres..."
            className="w-64 rounded-md border border-kb-border px-3 py-1.5 text-sm"
          />
          <select
            name="mudurluk"
            defaultValue={sp.mudurluk ?? ""}
            className="rounded-md border border-kb-border px-3 py-1.5 text-sm"
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
            className="rounded-md border border-kb-border px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Türler</option>
            {turler.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-kb-navy px-4 py-1.5 text-sm text-white">
            Filtrele
          </button>
        </form>
      </StickyFilter>

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
            <th>Şikayet No</th>
            <th>Tarih</th>
            <th>Arayan</th>
            <th>Mahalle</th>
            <th>Tür</th>
            <th>Müdürlük</th>
            <th>Plaka</th>
            <th>Personel</th>
            <th>Kanal</th>
            <th>Öncelik</th>
            <th>Durum</th>
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
        }}
      />
    </div>
  );
}
