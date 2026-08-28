import { prisma } from "@kars/db";
import { yakitOlustur, yakitGuncelle, yakitSil } from "@/lib/actions/vehicles";
import { YAKIT_TURU_LABELS } from "@kars/shared";
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

export default async function YakitPage({
  searchParams,
}: {
  searchParams: Promise<{ duzenle?: string }>;
}) {
  const session = await requirePageAccess("/yakit");
  const { duzenle } = await searchParams;
  const dept = departmentScope(session);
  const vehicleWhere = {
    envanterDurumu: { not: "HURDAYA_AYRILDI" as const },
    ...dept,
  };
  const fuelWhere = dept.departmentId
    ? { vehicle: { departmentId: dept.departmentId } }
    : undefined;

  const taskSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [kayitlar, araclar, personeller, toplam, gorevler] = await Promise.all([
    prisma.fuelRecord.findMany({
      where: fuelWhere,
      orderBy: { tarih: "desc" },
      take: 50,
      include: { vehicle: true, sorumluPersonel: true },
    }),
    prisma.vehicle.findMany({
      where: vehicleWhere,
      orderBy: { plaka: "asc" },
    }),
    prisma.personnel.findMany({
      where: { durum: "AKTIF", ...dept },
      orderBy: { adSoyad: "asc" },
    }),
    prisma.fuelRecord.aggregate({
      where: fuelWhere,
      _sum: { litre: true, tutar: true },
    }),
    prisma.vehicleTask.findMany({
      where: {
        talepTarihi: { gte: taskSince },
        ...(dept.departmentId ? { vehicle: { departmentId: dept.departmentId } } : {}),
      },
      orderBy: { talepTarihi: "desc" },
      take: 100,
      select: {
        id: true,
        gorevNo: true,
        gorevTanimi: true,
        vehicle: { select: { plaka: true } },
      },
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
      <PageHeader title="Yakıt Takip Çizelgesi" />
      <p className="text-sm text-kb-muted">
        Toplam tutar otomatik hesaplanır: litre × birim fiyat (Excel formülü).
      </p>

      <form
        action={duzenlenen ? yakitGuncelle : yakitOlustur}
        className="rounded-lg border border-kb-border bg-white shadow-sm p-4 grid md:grid-cols-4 lg:grid-cols-7 gap-3 items-end"
      >
        {duzenlenen && <input type="hidden" name="id" value={duzenlenen.id} />}
        {duzenlenen && (
          <p className="md:col-span-4 lg:col-span-7 text-sm font-semibold text-kb-navy">
            Kayıt düzenleniyor ·{" "}
            <Link href="/yakit" className="font-normal underline">
              Vazgeç
            </Link>
          </p>
        )}
        <div>
          <label className="text-xs text-kb-muted block mb-1">Tarih</label>
          <input
            name="tarih"
            type="date"
            defaultValue={isoGun(duzenlenen?.tarih ?? new Date())}
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
          <label className="text-xs text-kb-muted block mb-1">Yakıt Türü</label>
          <select
            name="yakitTuru"
            defaultValue={duzenlenen?.yakitTuru ?? "MOTORIN"}
            className={inputCls}
          >
            {Object.entries(YAKIT_TURU_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Miktar (Litre) *</label>
          <input
            name="litre"
            type="number"
            step="0.01"
            required
            defaultValue={duzenlenen ? Number(duzenlenen.litre) : ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Birim Fiyat (TL) *</label>
          <input
            name="birimFiyat"
            type="number"
            step="0.01"
            required
            defaultValue={duzenlenen ? Number(duzenlenen.birimFiyat) : ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Sayaç (KM/Saat)</label>
          <input
            name="sayac"
            type="number"
            step="0.1"
            defaultValue={duzenlenen?.sayac ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Sorumlu Personel</label>
          <select
            name="sorumluPersonelId"
            defaultValue={duzenlenen?.sorumluPersonelId ?? ""}
            className={inputCls}
          >
            <option value="">— Seçiniz —</option>
            {personeller.map((p) => (
              <option key={p.id} value={p.id}>{p.adSoyad}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Görev (maliyet takibi)</label>
          <select
            name="vehicleTaskId"
            defaultValue={duzenlenen?.vehicleTaskId ?? ""}
            className={inputCls}
          >
            <option value="">— Bağlanmadı —</option>
            {gorevler.map((g) => (
              <option key={g.id} value={g.id}>
                {g.gorevNo} · {g.vehicle.plaka}
                {g.gorevTanimi ? ` — ${g.gorevTanimi.slice(0, 40)}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-4 py-2 text-sm font-medium lg:col-span-7 md:col-span-4">
          {duzenlenen ? "Güncelle" : "+ Yakıt Kaydı Ekle"}
        </button>
      </form>

      <div className="rounded-lg border border-kb-border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
              <th className="p-3">No</th>
              <th className="p-3">Tarih</th>
              <th className="p-3">Plaka</th>
              <th className="p-3">Araç Adı</th>
              <th className="p-3">Yakıt Türü</th>
              <th className="p-3">Litre</th>
              <th className="p-3">Birim Fiyat</th>
              <th className="p-3">Toplam Tutar</th>
              <th className="p-3">Sayaç</th>
              <th className="p-3">Sorumlu</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((y, i) => (
              <tr key={y.id} className="border-b border-kb-border/60">
                <td className="p-3 text-kb-muted">{kayitlar.length - i}</td>
                <td className="p-3">{y.tarih.toLocaleDateString("tr-TR")}</td>
                <td className="p-3 font-mono">
                  <Link href={`/araclar/${y.vehicleId}`} className="text-kb-navy hover:underline">
                    {y.vehicle.plaka}
                  </Link>
                </td>
                <td className="p-3">{y.vehicle.ad ?? "—"}</td>
                <td className="p-3">{YAKIT_TURU_LABELS[y.yakitTuru]}</td>
                <td className="p-3">{Number(y.litre).toLocaleString("tr-TR")}</td>
                <td className="p-3">{Number(y.birimFiyat).toLocaleString("tr-TR")} ₺</td>
                <td className="p-3 font-medium">{Number(y.tutar).toLocaleString("tr-TR")} ₺</td>
                <td className="p-3">{y.sayac?.toLocaleString("tr-TR") ?? "—"}</td>
                <td className="p-3">{y.sorumluPersonel?.adSoyad ?? "—"}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/yakit?duzenle=${y.id}`} className="text-xs text-kb-navy hover:underline">
                      Düzenle
                    </Link>
                    <ConfirmSubmit
                      action={yakitSil}
                      id={y.id}
                      message="Bu yakıt kaydı silinsin mi?"
                    >
                      Sil
                    </ConfirmSubmit>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="bg-[#eef2f6] font-semibold">
              <td colSpan={5} className="p-3">TOPLAM YAKIT GİDERİ</td>
              <td className="p-3">{Number(toplam._sum.litre ?? 0).toLocaleString("tr-TR")} Lt</td>
              <td />
              <td className="p-3">{Number(toplam._sum.tutar ?? 0).toLocaleString("tr-TR")} ₺</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
