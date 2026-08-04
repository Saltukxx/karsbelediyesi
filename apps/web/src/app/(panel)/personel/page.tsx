import Link from "next/link";
import { prisma } from "@kars/db";
import { PERSONEL_DURUM_LABELS } from "@kars/shared";
import { personelOlustur, personelGuncelle } from "@/lib/actions/personnel";
import { inputCls, btnPrimary, btnSecondary, formCardCls } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { FilterChips } from "@/components/ui/FilterChips";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { PasifeAlButton } from "./PasifeAlButton";

export const dynamic = "force-dynamic";

export default async function PersonelPage({
  searchParams,
}: {
  searchParams: Promise<{ pasif?: string }>;
}) {
  const session = await requirePageAccess("/personel");
  const sp = await searchParams;
  const pasifleriGoster = sp.pasif === "1";
  const dept = departmentScope(session);
  const [personeller, mudurlukler] = await Promise.all([
    prisma.personnel.findMany({
      where: {
        ...dept,
        ...(pasifleriGoster
          ? { durum: "AYRILDI" as const }
          : { durum: { not: "AYRILDI" as const } }),
      },
      orderBy: { adSoyad: "asc" },
      include: { department: true },
    }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Personel Yönetimi"
        description="Personel listesi ve durum takibi (Aktif / İzinli / Raporlu / Ayrıldı)."
      />

      <FilterChips
        param="pasif"
        label="Personel görünümü"
        allLabel="Aktif liste"
        options={[{ id: "1", label: "Pasifleri göster" }]}
      />

      <form action={personelOlustur} className={`${formCardCls} grid md:grid-cols-3 lg:grid-cols-4 gap-3 items-end !max-w-none`}>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Ad Soyad *</label>
          <input name="adSoyad" required className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Unvan / Görev</label>
          <input name="unvan" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Bağlı Birim</label>
          <select name="departmentId" className={inputCls}>
            <option value="">— Seçiniz —</option>
            {mudurlukler.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Telefon</label>
          <input name="telefon" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">İşe Giriş Tarihi</label>
          <input name="iseGirisTarihi" type="date" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Durum</label>
          <select name="durum" defaultValue="AKTIF" className={inputCls}>
            {Object.entries(PERSONEL_DURUM_LABELS)
              .filter(([k]) => k !== "AYRILDI")
              .map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Saat Ücreti (₺)</label>
          <input name="saatUcret" type="number" step="0.01" min="0" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Not</label>
          <input name="not" className={inputCls} />
        </div>
        <button className={`${btnPrimary} lg:col-span-4 md:col-span-3`}>+ Personel Ekle</button>
      </form>

      <DataTable
        minWidth="900px"
        empty={personeller.length === 0}
        emptyTitle={pasifleriGoster ? "Pasif personel yok" : "Personel kaydı yok"}
        emptyDescription={
          pasifleriGoster
            ? "Ayrılmış personel bulunmuyor."
            : "Üstteki formdan yeni personel ekleyebilirsiniz."
        }
      >
        <thead>
          <tr>
            <th>No</th>
            <th>Ad Soyad</th>
            <th>Unvan</th>
            <th>Birim</th>
            <th>Telefon</th>
            <th>İşe Giriş</th>
            <th>Saat Ücreti</th>
            <th>Durum</th>
            <th className="!text-right">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {personeller.map((p, i) => (
            <tr key={p.id} className="group">
              <td className="text-kb-muted">{i + 1}</td>
              <td colSpan={8}>
                <div className="space-y-2">
                  <form action={personelGuncelle} className="grid items-end gap-2 md:grid-cols-8">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="adSoyad" defaultValue={p.adSoyad} required className={inputCls} />
                    <input name="unvan" defaultValue={p.unvan ?? ""} className={inputCls} />
                    <select name="departmentId" defaultValue={p.departmentId ?? ""} className={inputCls}>
                      <option value="">—</option>
                      {mudurlukler.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.shortName || m.name}
                        </option>
                      ))}
                    </select>
                    <input name="telefon" defaultValue={p.telefon ?? ""} className={inputCls} />
                    <input
                      name="iseGirisTarihi"
                      type="date"
                      defaultValue={p.iseGirisTarihi?.toISOString().slice(0, 10) ?? ""}
                      className={inputCls}
                    />
                    <input
                      name="saatUcret"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="₺/saat"
                      defaultValue={p.saatUcret ? Number(p.saatUcret) : ""}
                      className={inputCls}
                    />
                    <div className="flex flex-col gap-1">
                      <StatusBadge label={PERSONEL_DURUM_LABELS[p.durum]} />
                      <select name="durum" defaultValue={p.durum} className={inputCls}>
                        {Object.entries(PERSONEL_DURUM_LABELS)
                          .filter(([k]) =>
                            p.durum === "AYRILDI" ? true : k !== "AYRILDI",
                          )
                          .map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button className={`${btnSecondary} opacity-100 sm:opacity-0 sm:group-hover:opacity-100`}>
                      Kaydet
                    </button>
                  </form>
                  {p.durum !== "AYRILDI" && (
                    <PasifeAlButton personelId={p.id} adSoyad={p.adSoyad} />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      {!pasifleriGoster && (
        <p className="text-xs text-kb-muted">
          Ayrılmış personel varsayılan listede gizlidir.{" "}
          <Link href="/personel?pasif=1" className="text-kb-navy underline">
            Pasifleri göster
          </Link>
        </p>
      )}
    </div>
  );
}
