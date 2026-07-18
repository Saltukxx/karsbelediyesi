import { prisma } from "@kars/db";
import { sikayetOlustur } from "@/lib/actions/complaints";
import { ONCELIK_LABELS } from "@kars/shared";
import Link from "next/link";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function YeniSikayetPage() {
  await requirePageAccess("/sikayetler");
  const [mahalleler, turler, mudurlukler, araclar, personeller] = await Promise.all([
    prisma.neighborhood.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.complaintType.findMany({ where: { aktif: true }, include: { defaultDepartment: true } }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({
      where: { envanterDurumu: "AKTIF" },
      include: { atananSofor: true },
      orderBy: { plaka: "asc" },
    }),
    prisma.personnel.findMany({ where: { durum: "AKTIF" }, orderBy: { adSoyad: "asc" } }),
  ]);

  const inputCls =
    "w-full rounded-md border border-kb-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kb-navy/30";
  const labelCls = "block text-sm font-medium mb-1 text-kb-ink";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/sikayetler" className="text-kb-muted hover:text-kb-muted">←</Link>
        <h1 className="font-brand text-2xl font-semibold tracking-tight text-kb-navy">
          Yeni Şikayet Kaydı
        </h1>
      </div>
      <p className="text-sm text-kb-muted">
        Şikayet numarası otomatik verilir. Tür seçildiğinde müdürlük otomatik önerilir;
        plaka seçildiğinde şoför bilgisi zimmetten gelir.
      </p>

      <form action={sikayetOlustur} className="rounded-lg border border-kb-border bg-white shadow-sm p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Arayan Kişi *</label>
            <input name="arayanKisi" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefon</label>
            <input name="telefon" type="tel" placeholder="05xxxxxxxxx" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mahalle</label>
            <select name="neighborhoodId" className={inputCls} defaultValue="">
              <option value="">— Seçiniz —</option>
              {mahalleler.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Açık Adres</label>
            <input name="acikAdres" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Şikayet Türü</label>
            <select name="complaintTypeId" className={inputCls} defaultValue="">
              <option value="">— Seçiniz —</option>
              {turler.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.defaultDepartment ? ` → ${t.defaultDepartment.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Yönlendirilen Müdürlük</label>
            <select name="departmentId" className={inputCls} defaultValue="">
              <option value="">— Türe göre otomatik —</option>
              {mudurlukler.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Öncelik</label>
            <select name="oncelik" className={inputCls} defaultValue="NORMAL">
              {Object.entries(ONCELIK_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Görevlendirilen Araç (Plaka)</label>
            <select name="vehicleId" className={inputCls} defaultValue="">
              <option value="">— Sonra atanabilir —</option>
              {araclar.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.plaka}
                  {a.atananSofor ? ` (Şoför: ${a.atananSofor.name})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Açıklama</label>
          <textarea name="aciklama" rows={3} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Görevlendirilen Personel</label>
          <select name="personnelIds" multiple size={5} className={inputCls}>
            {personeller.map((p) => (
              <option key={p.id} value={p.id}>
                {p.adSoyad} {p.unvan ? `— ${p.unvan}` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-kb-muted mt-1">Cmd/Ctrl ile birden fazla seçilebilir.</p>
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href="/sikayetler"
            className="rounded-md border border-kb-border px-4 py-2 text-sm text-kb-muted"
          >
            Vazgeç
          </Link>
          <button
            type="submit"
            className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-6 py-2 text-sm font-medium"
          >
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}
