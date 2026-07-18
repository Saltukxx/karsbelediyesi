import { Suspense } from "react";
import { prisma } from "@kars/db";
import {
  agregaFizikselMaliyet,
  agregaProjeMaliyet,
  agregaAsamaPayi,
  agregaYillikUretim,
  agregaAylikMaliyet,
  agregaYillikMaliyet,
  agregaStokPayi,
} from "@kars/shared";
import { agregaParametreKaydet } from "@/lib/actions/agrega";
import { cardCls, inputCls, btnPrimary } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

type BoyutSatis = {
  boyut: string;
  oran: number;
  satisFiyati: number;
  stokHedefi: number;
};

function numField(
  name: string,
  label: string,
  value: number,
  step = "0.01",
) {
  return (
    <div key={name}>
      <label className="text-xs text-kb-muted block mb-1">{label}</label>
      <input name={name} type="number" step={step} defaultValue={value} className={inputCls} />
    </div>
  );
}

export default async function AgregaPage() {
  await requirePageAccess("/agrega");
  const params = await prisma.agregaParams.findUnique({ where: { ad: "varsayilan" } });
  if (!params) {
    return (
      <div className="space-y-4">
        <PageHeader title="Agrega Maliyet Analizi" />
        <p className="text-sm text-kb-muted">Parametreler henüz seed edilmedi. `npm run db:seed` çalıştırın.</p>
      </div>
    );
  }

  const boyutSatis = (params.boyutSatis as BoyutSatis[] | null) ?? [
    { boyut: "0-5 mm", oran: params.oran05, satisFiyati: 180, stokHedefi: 1000 },
    { boyut: "5-12 mm", oran: params.oran512, satisFiyati: 220, stokHedefi: 1000 },
    { boyut: "12-19 mm", oran: params.oran1219, satisFiyati: 240, stokHedefi: 1000 },
    { boyut: "19-32 mm", oran: params.oran1932, satisFiyati: 250, stokHedefi: 1000 },
  ];

  const fiziksel = agregaFizikselMaliyet({
    mesafeKm: params.mesafeKm,
    motorinFiyat: params.motorinFiyat,
    elektrikFiyat: params.elektrikFiyat,
    sokumYakitLtSaat: params.sokumYakitLtSaat,
    sokumAmortisman: params.sokumAmortisman,
    sokumKapasiteTonSaat: params.sokumKapasiteTonSaat,
    yuklemeYakitLtSaat: params.yuklemeYakitLtSaat,
    yuklemeAmortisman: params.yuklemeAmortisman,
    yuklemeKapasiteTonSaat: params.yuklemeKapasiteTonSaat,
    kamyonKapasiteTon: params.kamyonKapasiteTon,
    kamyonYakitLtKm: params.kamyonYakitLtKm,
    seferHizKmSaat: params.seferHizKmSaat,
    yuklemeBosaltmaDk: params.yuklemeBosaltmaDk,
    kamyonAmortisman: params.kamyonAmortisman,
    kiriciKw: params.kiriciKw,
    yukFaktoru: params.yukFaktoru,
    kiriciKapasiteTonSaat: params.kiriciKapasiteTonSaat,
    oran05: params.oran05,
    oran512: params.oran512,
    oran1219: params.oran1219,
    oran1932: params.oran1932,
    donemUretimTon: params.donemUretimTon,
  });

  const proje = agregaProjeMaliyet({
    gunlukHedefTon: params.gunlukHedefTon,
    kiriciYakitTon: params.kiriciYakitTon,
    kiriciBakimTon: params.kiriciBakimTon,
    yukleyiciYakitTon: params.yukleyiciYakitTon,
    yukleyiciBakimTon: params.yukleyiciBakimTon,
    nakliyeYakitTon: params.nakliyeYakitTon,
    elekElektrikTon: params.elekElektrikTon,
    elemeBakimTon: params.elemeBakimTon,
    yikamaSuTon: params.yikamaSuTon,
    genelGiderTon: params.genelGiderTon,
    boyutlar: boyutSatis,
  });

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Agrega Maliyet Analizi" />
        <p className="text-sm text-kb-muted">
          Fiziksel model (aşama 1–4 TL/ton) + proje modeli (₺/ton kalemler). Parametreleri kaydedince sonuçlar yeniden hesaplanır.
        </p>
      </div>

      <Suspense fallback={null}>
        <Tabs
          defaultTab="sonuclar"
          tabs={[
            { id: "sonuclar", label: "Sonuçlar" },
            { id: "parametreler", label: "Parametreler" },
          ]}
        />

        <TabPanel id="sonuclar" defaultTab="sonuclar">
          <div className="grid md:grid-cols-2 gap-4">
            <div className={`${cardCls} p-4 space-y-2`}>
              <h2 className="font-semibold">Fiziksel Model (TL/ton)</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Aşama 1 Söküm: <strong className="">{fiziksel.asama1.toFixed(2)}</strong> ({(agregaAsamaPayi(fiziksel.asama1, fiziksel.toplamBirim) * 100).toFixed(1)}%)</div>
                <div>Aşama 2 Yükleme: <strong className="">{fiziksel.asama2.toFixed(2)}</strong> ({(agregaAsamaPayi(fiziksel.asama2, fiziksel.toplamBirim) * 100).toFixed(1)}%)</div>
                <div>Aşama 3 Nakliye: <strong className="">{fiziksel.asama3.toFixed(2)}</strong> ({(agregaAsamaPayi(fiziksel.asama3, fiziksel.toplamBirim) * 100).toFixed(1)}%)</div>
                <div>Aşama 4 Kırıcı: <strong className="">{fiziksel.asama4.toFixed(2)}</strong> ({(agregaAsamaPayi(fiziksel.asama4, fiziksel.toplamBirim) * 100).toFixed(1)}%)</div>
                <div className="col-span-2 text-lg">
                  Toplam birim: <strong className="">{fiziksel.toplamBirim.toFixed(2)} TL/ton</strong>
                </div>
                <div className="col-span-2">
                  Dönem toplam: <strong className="">
                    {fiziksel.donemToplamMaliyet.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
                  </strong>
                </div>
              </div>
            </div>
            <div className={`${cardCls} p-4 space-y-2`}>
              <h2 className="font-semibold">Proje Modeli (₺/ton)</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Maden: <strong className="">{proje.maden.toFixed(2)}</strong></div>
                <div>Nakliye: <strong className="">{proje.nakliye.toFixed(2)}</strong></div>
                <div>Eleme: <strong className="">{proje.eleme.toFixed(2)}</strong></div>
                <div>Genel: <strong className="">{proje.genel.toFixed(2)}</strong></div>
                <div className="col-span-2 text-lg">
                  Birim maliyet: <strong className="">{proje.birim.toFixed(2)} ₺/ton</strong>
                </div>
                <div>Ağırlıklı satış: <strong className="">{proje.agirlikliSatis.toFixed(2)}</strong></div>
                <div>Ağırlıklı kâr: <strong className="">{proje.agirlikliKar.toFixed(2)}</strong></div>
                <div>Yıllık üretim: <strong className="">{agregaYillikUretim(params.gunlukHedefTon, params.yillikCalismaGun).toLocaleString("tr-TR")} ton</strong></div>
                <div>Günlük maliyet: <strong className="">{proje.gunluk.toLocaleString("tr-TR")} ₺</strong></div>
                <div>Aylık maliyet: <strong className="">{agregaAylikMaliyet(proje.gunluk, params.yillikCalismaGun).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺</strong></div>
                <div>Yıllık maliyet: <strong className="">{agregaYillikMaliyet(proje.gunluk, params.yillikCalismaGun).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺</strong></div>
              </div>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Boyut bazlı sonuçlar (proje)</h2>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                    <th className="p-3">Boyut</th>
                    <th className="p-3">Oran</th>
                    <th className="p-3">Günlük ton</th>
                    <th className="p-3">Satış</th>
                    <th className="p-3">Brüt kâr/ton</th>
                    <th className="p-3">Stok maliyeti</th>
                    <th className="p-3">Stok payı</th>
                    <th className="p-3">Potansiyel kâr</th>
                  </tr>
                </thead>
                <tbody>
                  {proje.boyutDetay.map((b) => (
                    <tr key={b.boyut} className="border-b border-kb-border/60">
                      <td className="p-3">{b.boyut}</td>
                      <td className="p-3">{(b.oran * 100).toFixed(0)}%</td>
                      <td className="p-3">{b.gunlukTon.toFixed(1)}</td>
                      <td className="p-3">{b.satisFiyati}</td>
                      <td className="p-3">{b.brutKarTon.toFixed(2)}</td>
                      <td className="p-3">{b.stokMaliyeti.toLocaleString("tr-TR")}</td>
                      <td className="p-3">{(agregaStokPayi(b.stokHedefi, proje.toplamStokHedefi) * 100).toFixed(1)}%</td>
                      <td className="p-3">{b.potansiyelKar.toLocaleString("tr-TR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>

        <TabPanel id="parametreler" defaultTab="sonuclar">
          <form action={agregaParametreKaydet} className={`${cardCls} p-4 space-y-4`}>
            <h2 className="text-base font-semibold text-kb-ink">Parametreler</h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
              {numField("mesafeKm", "Mesafe (km)", params.mesafeKm)}
              {numField("motorinFiyat", "Motorin (TL/lt)", params.motorinFiyat)}
              {numField("elektrikFiyat", "Elektrik (TL/kWh)", params.elektrikFiyat)}
              {numField("donemUretimTon", "Dönem üretim (ton)", params.donemUretimTon, "1")}
              {numField("sokumYakitLtSaat", "Söküm yakıt lt/saat", params.sokumYakitLtSaat)}
              {numField("sokumAmortisman", "Söküm amortisman", params.sokumAmortisman)}
              {numField("sokumKapasiteTonSaat", "Söküm kapasite t/saat", params.sokumKapasiteTonSaat)}
              {numField("yuklemeYakitLtSaat", "Yükleme yakıt lt/saat", params.yuklemeYakitLtSaat)}
              {numField("yuklemeAmortisman", "Yükleme amortisman", params.yuklemeAmortisman)}
              {numField("yuklemeKapasiteTonSaat", "Yükleme kapasite t/saat", params.yuklemeKapasiteTonSaat)}
              {numField("kamyonKapasiteTon", "Kamyon kapasite (ton)", params.kamyonKapasiteTon)}
              {numField("kamyonYakitLtKm", "Kamyon lt/km", params.kamyonYakitLtKm)}
              {numField("seferHizKmSaat", "Sefer hız km/saat", params.seferHizKmSaat)}
              {numField("yuklemeBosaltmaDk", "Yükleme/boşaltma dk", params.yuklemeBosaltmaDk)}
              {numField("kamyonAmortisman", "Kamyon amortisman", params.kamyonAmortisman)}
              {numField("kiriciKw", "Kırıcı kW", params.kiriciKw)}
              {numField("yukFaktoru", "Yük faktörü", params.yukFaktoru)}
              {numField("kiriciKapasiteTonSaat", "Kırıcı kapasite t/saat", params.kiriciKapasiteTonSaat)}
              {numField("oran05", "Oran 0-5", params.oran05)}
              {numField("oran512", "Oran 5-12", params.oran512)}
              {numField("oran1219", "Oran 12-19", params.oran1219)}
              {numField("oran1932", "Oran 19-32", params.oran1932)}
            </div>
            <h3 className="font-medium">Proje kalemleri (₺/ton)</h3>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
              {numField("gunlukHedefTon", "Günlük hedef ton", params.gunlukHedefTon, "1")}
              {numField("yillikCalismaGun", "Yıllık çalışma gün", params.yillikCalismaGun, "1")}
              {numField("kiriciYakitTon", "Kırıcı yakıt", params.kiriciYakitTon)}
              {numField("kiriciBakimTon", "Kırıcı bakım", params.kiriciBakimTon)}
              {numField("yukleyiciYakitTon", "Yükleyici yakıt", params.yukleyiciYakitTon)}
              {numField("yukleyiciBakimTon", "Yükleyici bakım", params.yukleyiciBakimTon)}
              {numField("nakliyeYakitTon", "Nakliye yakıt", params.nakliyeYakitTon)}
              {numField("elekElektrikTon", "Elek elektrik", params.elekElektrikTon)}
              {numField("elemeBakimTon", "Eleme bakım", params.elemeBakimTon)}
              {numField("yikamaSuTon", "Yıkama su", params.yikamaSuTon)}
              {numField("genelGiderTon", "Genel gider", params.genelGiderTon)}
              {numField("satis05", "Satış 0-5", boyutSatis[0]?.satisFiyati ?? 180)}
              {numField("stok05", "Stok hedef 0-5", boyutSatis[0]?.stokHedefi ?? 1000, "1")}
              {numField("satis512", "Satış 5-12", boyutSatis[1]?.satisFiyati ?? 220)}
              {numField("stok512", "Stok hedef 5-12", boyutSatis[1]?.stokHedefi ?? 1000, "1")}
              {numField("satis1219", "Satış 12-19", boyutSatis[2]?.satisFiyati ?? 240)}
              {numField("stok1219", "Stok hedef 12-19", boyutSatis[2]?.stokHedefi ?? 1000, "1")}
              {numField("satis1932", "Satış 19-32", boyutSatis[3]?.satisFiyati ?? 250)}
              {numField("stok1932", "Stok hedef 19-32", boyutSatis[3]?.stokHedefi ?? 1000, "1")}
            </div>
            <button className={btnPrimary}>Parametreleri Kaydet & Yeniden Hesapla</button>
          </form>
        </TabPanel>
      </Suspense>
    </div>
  );
}
