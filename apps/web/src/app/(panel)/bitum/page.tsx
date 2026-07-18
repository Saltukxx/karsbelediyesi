import { Suspense } from "react";
import { prisma } from "@kars/db";
import {
  bitumDoluluk,
  bitumDepoDurumu,
  bitumSeferMaliyeti,
  bitumTonTasima,
  bitumKiralikStok,
  bitumAnaDepoStok,
  bitumOrtAlisFiyati,
  bitumOrtVarisMaliyeti,
  bitumKritikUyari,
} from "@kars/shared";
import { bitumAyarKaydet, bitumHareketOlustur } from "@/lib/actions/bitum";
import { cardCls, inputCls, btnPrimary } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function BitumPage() {
  await requirePageAccess("/bitum");
  const [settings, depots, movements] = await Promise.all([
    prisma.bitumSettings.findUnique({ where: { id: "default" } }),
    prisma.bitumDepot.findMany({ where: { aktif: true }, orderBy: { ad: "asc" } }),
    prisma.bitumMovement.findMany({
      orderBy: { tarih: "desc" },
      take: 80,
      include: {
        depo: true,
        kaynakDepo: true,
        hedefDepo: true,
        kullanimDepo: true,
      },
    }),
  ]);

  if (!settings) {
    return (
      <div className="space-y-4">
        <h1 className="font-brand text-2xl font-semibold tracking-tight text-kb-navy">Bitüm Takip</h1>
        <p className="text-sm text-kb-muted">Ayarlar seed edilmedi. `npm run db:seed` çalıştırın.</p>
      </div>
    );
  }

  const allMoves = await prisma.bitumMovement.findMany();
  const stokByDepo = new Map<string, number>();
  for (const d of depots) {
    if (d.tip === "KIRALIK") {
      const alis = allMoves
        .filter((m) => m.tip === "ALIS" && m.depoId === d.id)
        .reduce((s, m) => s + m.miktarTon, 0);
      const tasimaCikis = allMoves
        .filter((m) => m.tip === "TASIMA" && m.kaynakDepoId === d.id)
        .reduce((s, m) => s + m.miktarTon, 0);
      stokByDepo.set(d.id, bitumKiralikStok(alis, tasimaCikis));
    } else {
      const tasimaGiris = allMoves
        .filter((m) => m.tip === "TASIMA" && m.hedefDepoId === d.id)
        .reduce((s, m) => s + m.miktarTon, 0);
      const kullanim = allMoves
        .filter((m) => m.tip === "KULLANIM" && m.kullanimDepoId === d.id)
        .reduce((s, m) => s + m.miktarTon, 0);
      stokByDepo.set(d.id, bitumAnaDepoStok(tasimaGiris, kullanim));
    }
  }

  const alislar = allMoves.filter((m) => m.tip === "ALIS");
  const tasimalar = allMoves.filter((m) => m.tip === "TASIMA");
  const kullanimlar = allMoves.filter((m) => m.tip === "KULLANIM");
  const toplamAlisTon = alislar.reduce((s, m) => s + m.miktarTon, 0);
  const toplamAlisMaliyet = alislar.reduce((s, m) => s + (m.alisMaliyeti ?? 0), 0);
  const toplamTasimaTon = tasimalar.reduce((s, m) => s + m.miktarTon, 0);
  const toplamTasimaMaliyet = tasimalar.reduce((s, m) => s + (m.toplamMaliyet ?? 0), 0);
  const toplamTirSefer = tasimalar.reduce((s, m) => s + (m.tirSeferSayisi ?? 0), 0);
  const toplamTasimaTl = tasimalar.reduce((s, m) => s + (m.tasimaMaliyeti ?? 0), 0);
  const toplamKullanimTon = kullanimlar.reduce((s, m) => s + m.miktarTon, 0);
  const ortAlis = bitumOrtAlisFiyati(toplamAlisMaliyet, toplamAlisTon);
  const ortVaris = bitumOrtVarisMaliyeti(toplamTasimaMaliyet, toplamTasimaTon);

  const seferPreview = bitumSeferMaliyeti(settings.mesafeKm, settings.yakitTlKm);
  const tonPreview = bitumTonTasima(seferPreview, settings.tirKapasiteTon);
  const today = new Date().toISOString().slice(0, 10);
  const depoOzet = depots.map((d) => {
    const stok = stokByDepo.get(d.id) ?? 0;
    const doluluk = bitumDoluluk(stok, d.kapasite);
    const durum = bitumDepoDurumu(doluluk, settings.kritikEsik, settings.dusukEsik);
    return { d, stok, doluluk, durum };
  });
  const kritikSayisi = depoOzet.filter((x) => x.durum === "KRITIK").length;
  const toplamKapasite = depots.reduce((s, d) => s + d.kapasite, 0);
  const toplamStok = depoOzet.reduce((s, x) => s + x.stok, 0);
  const sistemDoluluk = bitumDoluluk(toplamStok, toplamKapasite);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Bitüm Maliyet & Stok" />
        <p className="text-sm text-kb-muted">
          Sefer = mesafe × 2 × yakıt TL/km · Ton taşıma = sefer / TIR kapasite · Alış/Taşıma/Kullanım hareketleri.
        </p>
      </div>

      <Suspense fallback={null}>
        <Tabs
          defaultTab="ozet"
          tabs={[
            { id: "ozet", label: "Özet" },
            { id: "hareket", label: "Hareket" },
            { id: "ayarlar", label: "Ayarlar" },
          ]}
        />

        <TabPanel id="ozet" defaultTab="ozet">
          <div className={`${cardCls} p-3 text-sm font-medium ${kritikSayisi > 0 ? "bg-amber-50 text-amber-900" : ""}`}>
            {bitumKritikUyari(kritikSayisi)}
          </div>
          <div className={`${cardCls} p-4 grid md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm`}>
            <div>Sefer: <strong className="">{seferPreview.toLocaleString("tr-TR")} ₺</strong></div>
            <div>Ton taşıma: <strong className="">{tonPreview.toFixed(2)} ₺/ton</strong></div>
            <div>Sistem stok: <strong className="">{toplamStok.toFixed(1)} / {toplamKapasite} ton</strong></div>
            <div>Doluluk: <strong className="">{(sistemDoluluk * 100).toFixed(1)}%</strong></div>
            <div>Ort. alış: <strong className="">{ortAlis != null ? ortAlis.toFixed(0) : "—"} ₺/ton</strong></div>
            <div>Ort. varış: <strong className="">{ortVaris != null ? ortVaris.toFixed(0) : "—"} ₺/ton</strong></div>
            <div>Toplam alış: <strong className="">{toplamAlisTon} ton / {toplamAlisMaliyet.toLocaleString("tr-TR")} ₺</strong></div>
            <div>TIR sefer: <strong className="">{toplamTirSefer}</strong></div>
            <div>Taşıma TL: <strong className="">{toplamTasimaTl.toLocaleString("tr-TR")}</strong></div>
            <div>Kullanım: <strong className="">{toplamKullanimTon} ton</strong></div>
            <div>Kritik depo: <strong className="">{kritikSayisi}</strong></div>
            <div>Referans alış: <strong className="">{settings.referansAlisFiyat.toLocaleString("tr-TR")}</strong></div>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Depo Stok Durumu</h2>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                    <th className="p-3">Depo</th>
                    <th className="p-3">Tip</th>
                    <th className="p-3">Stok (ton)</th>
                    <th className="p-3">Kapasite</th>
                    <th className="p-3">Doluluk</th>
                    <th className="p-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {depoOzet.map(({ d, stok, doluluk, durum }) => (
                      <tr key={d.id} className="border-b border-kb-border/60">
                        <td className="p-3">{d.ad}</td>
                        <td className="p-3">{d.tip}</td>
                        <td className="p-3">{stok.toFixed(2)}</td>
                        <td className="p-3">{d.kapasite}</td>
                        <td className="p-3">{(doluluk * 100).toFixed(1)}%</td>
                        <td className="p-3 font-semibold">{durum}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>

        <TabPanel id="hareket" defaultTab="ozet">
          <form action={bitumHareketOlustur} className={`${cardCls} p-4 grid md:grid-cols-3 lg:grid-cols-4 gap-3 items-end`}>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Tarih *</label>
              <input name="tarih" type="date" required defaultValue={today} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Tip *</label>
              <select name="tip" required className={inputCls}>
                <option value="ALIS">Alış</option>
                <option value="TASIMA">Taşıma</option>
                <option value="KULLANIM">Kullanım</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Miktar (ton) *</label>
              <input name="miktarTon" type="number" step="0.01" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Alış fiyatı (₺/ton)</label>
              <input name="alisFiyati" type="number" step="1" placeholder={String(settings.referansAlisFiyat)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Alış deposu</label>
              <select name="depoId" className={inputCls}>
                <option value="">—</option>
                {depots.map((d) => (
                  <option key={d.id} value={d.id}>{d.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Taşıma kaynak</label>
              <select name="kaynakDepoId" className={inputCls}>
                <option value="">—</option>
                {depots.map((d) => (
                  <option key={d.id} value={d.id}>{d.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Taşıma hedef</label>
              <select name="hedefDepoId" className={inputCls}>
                <option value="">—</option>
                {depots.map((d) => (
                  <option key={d.id} value={d.id}>{d.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Kullanım deposu</label>
              <select name="kullanimDepoId" className={inputCls}>
                <option value="">—</option>
                {depots.map((d) => (
                  <option key={d.id} value={d.id}>{d.ad}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-4">
              <label className="text-xs text-kb-muted block mb-1">Açıklama</label>
              <input name="aciklama" className={inputCls} />
            </div>
            <button className={`${btnPrimary} lg:col-span-4`}>+ Hareket Kaydet</button>
          </form>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Son Hareketler</h2>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                    <th className="p-3">Tarih</th>
                    <th className="p-3">Tip</th>
                    <th className="p-3">Miktar</th>
                    <th className="p-3">Depo / Rota</th>
                    <th className="p-3">Alış maliyet</th>
                    <th className="p-3">Taşıma</th>
                    <th className="p-3">Varış ₺/ton</th>
                    <th className="p-3">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-kb-border/60">
                      <td className="p-3">{m.tarih.toLocaleDateString("tr-TR")}</td>
                      <td className="p-3">{m.tip}</td>
                      <td className="p-3">{m.miktarTon}</td>
                      <td className="p-3">
                        {m.tip === "ALIS" && (m.depo?.ad ?? "—")}
                        {m.tip === "TASIMA" && `${m.kaynakDepo?.ad ?? "?"} → ${m.hedefDepo?.ad ?? "?"}`}
                        {m.tip === "KULLANIM" && (m.kullanimDepo?.ad ?? "—")}
                      </td>
                      <td className="p-3">
                        {m.alisMaliyeti?.toLocaleString("tr-TR") ?? "—"}
                      </td>
                      <td className="p-3">
                        {m.tasimaMaliyeti != null
                          ? `${m.tirSeferSayisi ?? 0} sefer / ${m.tasimaMaliyeti.toLocaleString("tr-TR")} ₺`
                          : "—"}
                      </td>
                      <td className="p-3">
                        {m.varisMaliyetiTon?.toFixed(2) ?? "—"}
                      </td>
                      <td className="p-3">
                        {m.toplamMaliyet?.toLocaleString("tr-TR") ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>

        <TabPanel id="ayarlar" defaultTab="ozet">
          <form action={bitumAyarKaydet} className={`${cardCls} p-4 grid md:grid-cols-3 lg:grid-cols-5 gap-3 items-end`}>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Depo kapasitesi (ton)</label>
              <input name="depoKapasitesiTon" type="number" step="0.1" defaultValue={settings.depoKapasitesiTon} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Mesafe (km)</label>
              <input name="mesafeKm" type="number" step="0.1" defaultValue={settings.mesafeKm} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">TIR kapasite (ton)</label>
              <input name="tirKapasiteTon" type="number" step="0.1" defaultValue={settings.tirKapasiteTon} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Yakıt TL/km</label>
              <input name="yakitTlKm" type="number" step="0.01" defaultValue={settings.yakitTlKm} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Referans alış ₺/ton</label>
              <input name="referansAlisFiyat" type="number" step="1" defaultValue={settings.referansAlisFiyat} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Kritik eşik (0-1)</label>
              <input name="kritikEsik" type="number" step="0.01" defaultValue={settings.kritikEsik} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Düşük eşik (0-1)</label>
              <input name="dusukEsik" type="number" step="0.01" defaultValue={settings.dusukEsik} className={inputCls} />
            </div>
            <button className={`${btnPrimary} lg:col-span-3`}>Ayarları Kaydet</button>
          </form>
        </TabPanel>
      </Suspense>
    </div>
  );
}
