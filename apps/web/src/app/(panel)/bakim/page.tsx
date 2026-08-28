import { prisma } from "@kars/db";
import { bakimOlustur, bakimGuncelle, bakimSil } from "@/lib/actions/vehicles";
import { BAKIM_TURU_LABELS, BAKIM_DURUM_LABELS } from "@kars/shared";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { departmentScope, requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-kb-border px-3 py-2 text-sm";

function isoGun(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const gun = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${gun}`;
}

export default async function BakimPage({
  searchParams,
}: {
  searchParams: Promise<{ duzenle?: string }>;
}) {
  const session = await requirePageAccess("/bakim");
  const { duzenle } = await searchParams;
  const dept = departmentScope(session);
  const vehicleWhere = {
    envanterDurumu: { not: "HURDAYA_AYRILDI" as const },
    ...dept,
  };
  const bakimWhere = dept.departmentId
    ? { vehicle: { departmentId: dept.departmentId } }
    : undefined;

  const [kayitlar, araclar, toplam] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      where: bakimWhere,
      orderBy: { bakimTarihi: "desc" },
      take: 50,
      include: { vehicle: { include: { department: true } } },
    }),
    prisma.vehicle.findMany({
      where: vehicleWhere,
      orderBy: { plaka: "asc" },
    }),
    prisma.maintenanceRecord.aggregate({
      where: bakimWhere,
      _sum: { maliyet: true },
    }),
  ]);

  const duzenlenen = duzenle
    ? kayitlar.find((k) => k.id === duzenle) ?? null
    : null;
  const formAraclar =
    duzenlenen && !araclar.some((a) => a.id === duzenlenen.vehicleId)
      ? [duzenlenen.vehicle, ...araclar]
      : araclar;

  return (
    <div className="space-y-4">
      <PageHeader title="Bakım ve Onarım Takip Çizelgesi" />

      <form
        action={duzenlenen ? bakimGuncelle : bakimOlustur}
        className="rounded-lg border border-kb-border bg-white shadow-sm p-4 grid md:grid-cols-4 lg:grid-cols-6 gap-3 items-end"
      >
        {duzenlenen && <input type="hidden" name="id" value={duzenlenen.id} />}
        {duzenlenen && (
          <p className="md:col-span-4 lg:col-span-6 text-sm font-semibold text-kb-navy">
            Kayıt düzenleniyor ·{" "}
            <Link href="/bakim" className="font-normal underline">
              Vazgeç
            </Link>
          </p>
        )}
        <div>
          <label className="text-xs text-kb-muted block mb-1">Bakım Tarihi</label>
          <input
            name="bakimTarihi"
            type="date"
            defaultValue={isoGun(duzenlenen?.bakimTarihi ?? new Date())}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Plaka *</label>
          <select
            name="vehicleId"
            required
            defaultValue={duzenlenen?.vehicleId ?? ""}
            className={inputCls}
          >
            <option value="">— Seçiniz —</option>
            {formAraclar.map((a) => (
              <option key={a.id} value={a.id}>{a.plaka} — {a.ad ?? ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Bakım Türü</label>
          <select
            name="bakimTuru"
            defaultValue={duzenlenen?.bakimTuru ?? "PERIYODIK"}
            className={inputCls}
          >
            {Object.entries(BAKIM_TURU_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="text-xs text-kb-muted block mb-1">Yapılan İşlemler</label>
          <input
            name="yapilanIslemler"
            defaultValue={duzenlenen?.yapilanIslemler ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Kullanılan Malzeme</label>
          <input
            name="kullanilanMalzeme"
            defaultValue={duzenlenen?.kullanilanMalzeme ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Maliyet (TL)</label>
          <input
            name="maliyet"
            type="number"
            step="0.01"
            defaultValue={duzenlenen?.maliyet != null ? Number(duzenlenen.maliyet) : ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Yapan Firma / Personel</label>
          <input
            name="yapanFirmaPersonel"
            defaultValue={duzenlenen?.yapanFirmaPersonel ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Sonraki Bakım</label>
          <input
            name="sonrakiBakimTarihi"
            type="date"
            defaultValue={
              duzenlenen?.sonrakiBakimTarihi
                ? isoGun(duzenlenen.sonrakiBakimTarihi)
                : ""
            }
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Durum</label>
          <select name="durum" defaultValue={duzenlenen?.durum ?? "PLANLANDI"} className={inputCls}>
            {Object.entries(BAKIM_DURUM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-4 py-2 text-sm font-medium">
          {duzenlenen ? "Güncelle" : "+ Bakım Kaydı Ekle"}
        </button>
      </form>

      <div className="rounded-lg border border-kb-border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
              <th className="p-3">No</th>
              <th className="p-3">Bakım Tarihi</th>
              <th className="p-3">Plaka</th>
              <th className="p-3">Araç Adı</th>
              <th className="p-3">Bakım Türü</th>
              <th className="p-3">Yapılan İşlemler</th>
              <th className="p-3">Malzeme</th>
              <th className="p-3">Maliyet (TL)</th>
              <th className="p-3">Yapan</th>
              <th className="p-3">Sonraki Bakım</th>
              <th className="p-3">Durum</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((b, i) => (
              <tr key={b.id} className="border-b border-kb-border/60">
                <td className="p-3 text-kb-muted">{kayitlar.length - i}</td>
                <td className="p-3">{b.bakimTarihi.toLocaleDateString("tr-TR")}</td>
                <td className="p-3 font-mono">
                  <Link href={`/araclar/${b.vehicleId}`} className="text-kb-navy hover:underline">
                    {b.vehicle.plaka}
                  </Link>
                </td>
                <td className="p-3">{b.vehicle.ad ?? "—"}</td>
                <td className="p-3">{BAKIM_TURU_LABELS[b.bakimTuru]}</td>
                <td className="p-3">{b.yapilanIslemler ?? "—"}</td>
                <td className="p-3">{b.kullanilanMalzeme ?? "—"}</td>
                <td className="p-3">
                  {b.maliyet != null ? Number(b.maliyet).toLocaleString("tr-TR") : "—"}
                </td>
                <td className="p-3">{b.yapanFirmaPersonel ?? "—"}</td>
                <td className="p-3">
                  {b.sonrakiBakimTarihi?.toLocaleDateString("tr-TR") ?? "—"}
                </td>
                <td className="p-3">{BAKIM_DURUM_LABELS[b.durum]}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/bakim?duzenle=${b.id}`} className="text-xs text-kb-navy hover:underline">
                      Düzenle
                    </Link>
                    <ConfirmSubmit
                      action={bakimSil}
                      id={b.id}
                      message="Bu bakım kaydı silinsin mi?"
                    >
                      Sil
                    </ConfirmSubmit>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="bg-[#eef2f6] font-semibold">
              <td colSpan={7} className="p-3">TOPLAM BAKIM MALİYETİ</td>
              <td className="p-3">
                {Number(toplam._sum.maliyet ?? 0).toLocaleString("tr-TR")} ₺
              </td>
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
