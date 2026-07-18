import { prisma } from "@kars/db";
import { PERSONEL_DURUM_LABELS } from "@kars/shared";
import { personelOlustur, personelGuncelle } from "@/lib/actions/personnel";
import { inputCls, btnPrimary, btnSecondary, formCardCls } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { departmentScope, requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function PersonelPage() {
  const session = await requirePageAccess("/personel");
  const dept = departmentScope(session);
  const [personeller, mudurlukler] = await Promise.all([
    prisma.personnel.findMany({
      where: dept,
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
            {Object.entries(PERSONEL_DURUM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="text-xs text-kb-muted block mb-1">Not</label>
          <input name="not" className={inputCls} />
        </div>
        <button className={`${btnPrimary} lg:col-span-4 md:col-span-3`}>+ Personel Ekle</button>
      </form>

      <DataTable
        minWidth="900px"
        empty={personeller.length === 0}
        emptyTitle="Personel kaydı yok"
        emptyDescription="Üstteki formdan yeni personel ekleyebilirsiniz."
      >
        <thead>
          <tr>
            <th>No</th>
            <th>Ad Soyad</th>
            <th>Unvan</th>
            <th>Birim</th>
            <th>Telefon</th>
            <th>İşe Giriş</th>
            <th>Durum</th>
            <th className="!text-right">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {personeller.map((p, i) => (
            <tr key={p.id} className="group">
              <td className="text-kb-muted">{i + 1}</td>
              <td colSpan={7}>
                <form action={personelGuncelle} className="grid items-end gap-2 md:grid-cols-7">
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
                  <div className="flex flex-col gap-1">
                    <StatusBadge label={PERSONEL_DURUM_LABELS[p.durum]} />
                    <select name="durum" defaultValue={p.durum} className={inputCls}>
                      {Object.entries(PERSONEL_DURUM_LABELS).map(([k, v]) => (
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
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
