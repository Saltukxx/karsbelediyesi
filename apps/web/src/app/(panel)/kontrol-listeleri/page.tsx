import { prisma } from "@kars/db";
import { kontrolFormuOlustur } from "@/lib/actions/checklists";
import { inputCls, btnPrimary, cardCls } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const DURUM_LABEL: Record<string, string> = {
  TASLAK: "Taslak",
  ONAY_BEKLIYOR: "Onay Bekliyor",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
};

export default async function KontrolListeleriPage() {
  await requirePageAccess("/kontrol-listeleri");
  const now = new Date();
  const [templates, submissions, araclar] = await Promise.all([
    prisma.checklistTemplate.findMany({
      where: { aktif: true },
      include: { _count: { select: { items: true } } },
      orderBy: { ekipmanAdi: "asc" },
    }),
    prisma.checklistSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { template: true, vehicle: true, onaylayan: true },
    }),
    prisma.vehicle.findMany({
      where: { envanterDurumu: { not: "HURDAYA_AYRILDI" } },
      orderBy: { plaka: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Kontrol Listeleri" />
        <p className="text-sm text-kb-muted">
          5 makine şablonu · hafta 1–4 + aylık bakım. ❌ kalemler otomatik bakım önerisi üretir.
        </p>
      </div>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => (
          <div key={t.id} className={`${cardCls} p-4`}>
            <div className="font-semibold">{t.ekipmanAdi}</div>
            <div className="text-sm text-kb-muted mt-1">{t._count.items} kontrol kalemi</div>
            {t.aciklama && <p className="text-xs text-kb-muted mt-2">{t.aciklama}</p>}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Yeni Form Başlat</h2>
        <form
          action={kontrolFormuOlustur}
          className={`${cardCls} p-4 grid md:grid-cols-3 lg:grid-cols-5 gap-3 items-end`}
        >
          <div>
            <label className="text-xs text-kb-muted block mb-1">Şablon *</label>
            <select name="templateId" required className={inputCls}>
              <option value="">—</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.ekipmanAdi}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Araç / Plaka *</label>
            <select name="vehicleId" required className={inputCls}>
              <option value="">—</option>
              {araclar.map((a) => (
                <option key={a.id} value={a.id}>{a.plaka}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Ay *</label>
            <input name="ay" type="number" min={1} max={12} required defaultValue={now.getMonth() + 1} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Yıl *</label>
            <input name="yilDonem" type="number" required defaultValue={now.getFullYear()} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Şantiye / Lokasyon</label>
            <input name="santiyeLokasyon" className={inputCls} />
          </div>
          <div className="lg:col-span-4">
            <label className="text-xs text-kb-muted block mb-1">Sorumlu Operatör / Teknisyen</label>
            <input name="sorumluOperatorTeknisyen" className={inputCls} />
          </div>
          <button className={btnPrimary}>Form Oluştur</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Doldurulan Formlar</h2>
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Şablon</th>
                <th className="p-3">Plaka</th>
                <th className="p-3">Dönem</th>
                <th className="p-3">Lokasyon</th>
                <th className="p-3">Durum</th>
                <th className="p-3">Onaylayan</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-kb-border/60">
                  <td className="p-3">
                    <Link href={`/kontrol-listeleri/${s.id}`} className="text-kb-navy hover:underline">
                      {s.template.ekipmanAdi}
                    </Link>
                  </td>
                  <td className="p-3 font-mono">{s.vehicle.plaka}</td>
                  <td className="p-3">{s.ay}/{s.yilDonem}</td>
                  <td className="p-3">{s.santiyeLokasyon ?? "—"}</td>
                  <td className="p-3">{DURUM_LABEL[s.durum] ?? s.durum}</td>
                  <td className="p-3">{s.onaylayan?.name ?? "—"}</td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-kb-muted">Henüz form yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
