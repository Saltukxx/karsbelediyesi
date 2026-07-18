/**
 * Plan dışı Excel dosyalarındaki formüllerin TypeScript karşılıkları.
 * Kaynak: Akaryakit Tuketim Takip, MalzemeDepo Envanter, Beton Receteleri,
 * Agrega Maliyet Analizi 2 / proje, Bitum maliyet 1.
 */

export type TuketimDurum = "NORMAL" | "DIKKAT" | "YUKSEK";
export type StokDurum = "NORMAL" | "DIKKAT" | "KRITIK";
export type BetonStokDurum = "KRITIK" | "AZ" | "YETERLI";

export const AY_ADLARI = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

/**
 * Yakıt Alım / Stok Hareketleri C sütunu:
 * =INDEX({"Ocak",...},MONTH(tarih))
 */
export function ayAdiFromDate(tarih: Date): (typeof AY_ADLARI)[number] {
  return AY_ADLARI[tarih.getMonth()];
}

/**
 * Sayaç farkı — Tüketim Analizi G:
 * =MAXIFS(sayac)-MINIFS(sayac)
 */
export function sayacFarkiMaxMin(sayaclar: number[]): number {
  const valid = sayaclar.filter((s) => Number.isFinite(s));
  if (valid.length < 2) return 0;
  return Math.max(...valid) - Math.min(...valid);
}

/**
 * Aylık Rapor F: =tutar/litre (ort. birim fiyat)
 * Excel: =IF(OR(A="",C=0),"",D/C)
 */
export function ortBirimFiyat(tutar: number, litre: number): number | null {
  if (litre <= 0) return null;
  return tutar / litre;
}

/**
 * Akaryakıt Tüketim Analizi — gerçek tüketim:
 * KM: litre / (sayacFarki/100)  → lt/100km
 * Saat: litre / sayacFarki      → lt/saat
 * Excel H: =IF(D="Kilometre (km)",E/(G/100),E/G)
 */
export function gercekTuketim(
  toplamLitre: number,
  sayacFarki: number,
  sayacTipi: "KM" | "SAAT",
): number | null {
  if (sayacFarki <= 0 || toplamLitre < 0) return null;
  return sayacTipi === "KM" ? toplamLitre / (sayacFarki / 100) : toplamLitre / sayacFarki;
}

/**
 * Durum: H > norm*1.15 → YÜKSEK; H > norm*1.05 → DİKKAT; else NORMAL
 * Excel: =IF(H>I*1.15,"YÜKSEK",IF(H>I*1.05,"DİKKAT","NORMAL"))
 */
export function tuketimDurumu(gercek: number, norm: number): TuketimDurum {
  if (gercek > norm * 1.15) return "YUKSEK";
  if (gercek > norm * 1.05) return "DIKKAT";
  return "NORMAL";
}

/** Stok = giriş − çıkış (MalzemeDepo Stok Durumu G: =E-F) */
export function mevcutStok(giris: number, cikis: number): number {
  return giris - cikis;
}

/**
 * MalzemeDepo Stok Durumu I:
 * =IF(G<=H,"KRİTİK",IF(G<=H*1.3,"DİKKAT","NORMAL"))
 */
export function stokDurumu(stok: number, kritik: number): StokDurum {
  if (stok <= kritik) return "KRITIK";
  if (stok <= kritik * 1.3) return "DIKKAT";
  return "NORMAL";
}

/**
 * MalzemeDepo Aylık Hareket F: =giriş − çıkış (aylık net)
 */
export function aylikNetHareket(giris: number, cikis: number): number {
  return giris - cikis;
}

/** Beton: su/çimento oranı — Receteler I: =IFERROR(G/B,0) */
export function suCimentoOrani(suLt: number, cimentoKg: number): number {
  if (cimentoKg <= 0) return 0;
  return suLt / cimentoKg;
}

/** Beton: toplam agrega = kum + micir'ler — Receteler J: =SUM(C:F) */
export function toplamAgregaKg(
  kum: number,
  m05: number,
  m512: number,
  m1219: number,
): number {
  return kum + m05 + m512 + m1219;
}

/** Beton: 1 m³ karışım toplamı — Receteler K: =B+C+D+E+F+G+H */
export function toplamKarisimKg(
  cimento: number,
  kum: number,
  m05: number,
  m512: number,
  m1219: number,
  su: number,
  katki: number,
): number {
  return cimento + kum + m05 + m512 + m1219 + su + katki;
}

/**
 * Yoğunluk kontrolü — Receteler L:
 * =IF(AND(K>=2300,K<=2500),"NORMAL (1 m3)","KONTROL ET")
 */
export function yogunlukKontrolu(toplamKg: number): string {
  if (toplamKg >= 2300 && toplamKg <= 2500) return "NORMAL (1 m3)";
  return "KONTROL ET";
}

/** Üretim: hedef m³ × reçete birim miktarı */
export function betonUretimMalzeme(hedefM3: number, birimKg: number): number {
  return hedefM3 * birimKg;
}

/**
 * Beton Malzeme Stok F: =başlangıç + giriş − üretim çıkışı
 * Excel: =C+D-E
 */
export function betonGuncelStok(
  baslangic: number,
  toplamGiris: number,
  uretimCikis: number,
): number {
  return baslangic + toplamGiris - uretimCikis;
}

/**
 * Beton Malzeme Stok H:
 * =IF(F<=G,"KRITIK",IF(F<=G*1.5,"AZ","YETERLI"))
 */
export function betonStokDurumu(stok: number, kritik: number): BetonStokDurum {
  if (stok <= kritik) return "KRITIK";
  if (stok <= kritik * 1.5) return "AZ";
  return "YETERLI";
}

export type AgregaFizikselParams = {
  mesafeKm: number;
  motorinFiyat: number;
  elektrikFiyat: number;
  sokumYakitLtSaat: number;
  sokumAmortisman: number;
  sokumKapasiteTonSaat: number;
  yuklemeYakitLtSaat: number;
  yuklemeAmortisman: number;
  yuklemeKapasiteTonSaat: number;
  kamyonKapasiteTon: number;
  kamyonYakitLtKm: number;
  seferHizKmSaat: number;
  yuklemeBosaltmaDk: number;
  kamyonAmortisman: number;
  kiriciKw: number;
  yukFaktoru: number;
  kiriciKapasiteTonSaat: number;
  oran05: number;
  oran512: number;
  oran1219: number;
  oran1932: number;
  donemUretimTon: number;
};

/**
 * Agrega Maliyet Analizi 2 — aşama birim maliyetleri (TL/ton).
 * Excel Maliyet Hesaplama formülleri birebir.
 */
export function agregaFizikselMaliyet(p: AgregaFizikselParams) {
  // Aşama 1 söküm
  const sokumYakitSaat = p.sokumYakitLtSaat * p.motorinFiyat;
  const sokumToplamSaat = sokumYakitSaat + p.sokumAmortisman;
  const asama1 = sokumToplamSaat / p.sokumKapasiteTonSaat;

  // Aşama 2 yükleme
  const yuklemeYakitSaat = p.yuklemeYakitLtSaat * p.motorinFiyat;
  const yuklemeToplamSaat = yuklemeYakitSaat + p.yuklemeAmortisman;
  const asama2 = yuklemeToplamSaat / p.yuklemeKapasiteTonSaat;

  // Aşama 3 nakliye
  const seferMesafe = 2 * p.mesafeKm;
  const seferYakit = p.kamyonYakitLtKm * seferMesafe * p.motorinFiyat;
  const seferSure = seferMesafe / p.seferHizKmSaat + p.yuklemeBosaltmaDk / 60;
  const seferAmort = p.kamyonAmortisman * seferSure;
  const seferToplam = seferYakit + seferAmort;
  const asama3 = seferToplam / p.kamyonKapasiteTon;

  // Aşama 4 kırıcı elektrik
  const elektrikKwhSaat = p.kiriciKw * p.yukFaktoru;
  const elektrikMaliyetSaat = elektrikKwhSaat * p.elektrikFiyat;
  const asama4 = elektrikMaliyetSaat / p.kiriciKapasiteTonSaat;

  const toplamBirim = asama1 + asama2 + asama3 + asama4;
  const boyutlar = [
    { boyut: "0-5 mm", oran: p.oran05 },
    { boyut: "5-12 mm", oran: p.oran512 },
    { boyut: "12-19 mm", oran: p.oran1219 },
    { boyut: "19-32 mm", oran: p.oran1932 },
  ].map((b) => ({
    ...b,
    tonaj: p.donemUretimTon * b.oran,
    birimMaliyet: toplamBirim,
    toplamMaliyet: p.donemUretimTon * b.oran * toplamBirim,
  }));

  return {
    asama1,
    asama2,
    asama3,
    asama4,
    toplamBirim,
    seferMesafe,
    seferYakit,
    seferSure,
    seferToplam,
    boyutlar,
    donemToplamMaliyet: boyutlar.reduce((s, b) => s + b.toplamMaliyet, 0),
  };
}

export type AgregaProjeParams = {
  gunlukHedefTon: number;
  kiriciYakitTon: number;
  kiriciBakimTon: number;
  yukleyiciYakitTon: number;
  yukleyiciBakimTon: number;
  nakliyeYakitTon: number;
  elekElektrikTon: number;
  elemeBakimTon: number;
  yikamaSuTon: number;
  genelGiderTon: number;
  boyutlar: Array<{
    boyut: string;
    oran: number;
    satisFiyati: number;
    stokHedefi: number;
  }>;
};

/** Agrega proje modeli — ₺/ton kalem toplamı */
export function agregaProjeMaliyet(p: AgregaProjeParams) {
  const maden =
    p.kiriciYakitTon + p.kiriciBakimTon + p.yukleyiciYakitTon + p.yukleyiciBakimTon;
  const nakliye = p.nakliyeYakitTon;
  const eleme = p.elekElektrikTon + p.elemeBakimTon + p.yikamaSuTon;
  const genel = p.genelGiderTon;
  const birim = maden + nakliye + eleme + genel;
  const gunluk = birim * p.gunlukHedefTon;

  const boyutDetay = p.boyutlar.map((b) => {
    const gunlukTon = p.gunlukHedefTon * b.oran;
    return {
      ...b,
      gunlukTon,
      birimMaliyet: birim,
      uretimMaliyetiGun: gunlukTon * birim,
      brutKarTon: b.satisFiyati - birim,
      stokMaliyeti: b.stokHedefi * birim,
      stokDegeri: b.stokHedefi * b.satisFiyati,
      potansiyelKar: b.stokHedefi * (b.satisFiyati - birim),
    };
  });

  const toplamOran = p.boyutlar.reduce((s, b) => s + b.oran, 0) || 1;
  const agirlikliSatis =
    p.boyutlar.reduce((s, b) => s + b.oran * b.satisFiyati, 0) / toplamOran;

  return {
    maden,
    nakliye,
    eleme,
    genel,
    birim,
    gunluk,
    boyutDetay,
    agirlikliSatis,
    agirlikliKar: agirlikliSatis - birim,
    toplamStokHedefi: boyutDetay.reduce((s, b) => s + b.stokHedefi, 0),
    toplamStokMaliyeti: boyutDetay.reduce((s, b) => s + b.stokMaliyeti, 0),
    toplamStokDegeri: boyutDetay.reduce((s, b) => s + b.stokDegeri, 0),
    potansiyelKar: boyutDetay.reduce((s, b) => s + b.potansiyelKar, 0),
  };
}

/** Bitüm: sefer maliyeti = mesafe * 2 * yakıtTlKm */
export function bitumSeferMaliyeti(mesafeKm: number, yakitTlKm: number): number {
  return mesafeKm * 2 * yakitTlKm;
}

/** Bitüm: ton taşıma = sefer / TIR kapasite */
export function bitumTonTasima(seferTl: number, tirKapasiteTon: number): number {
  if (tirKapasiteTon <= 0) return 0;
  return seferTl / tirKapasiteTon;
}

/** Bitüm: TIR sefer sayısı = CEILING(miktar / kapasite) */
export function bitumTirSefer(miktarTon: number, tirKapasiteTon: number): number {
  if (tirKapasiteTon <= 0) return 0;
  return Math.ceil(miktarTon / tirKapasiteTon);
}

/** Doluluk = stok / kapasite */
export function bitumDoluluk(stok: number, kapasite: number): number {
  if (kapasite <= 0) return 0;
  return stok / kapasite;
}

/**
 * Bitüm depo durumu: doluluk<=kritik → KRİTİK; <=düşük → DÜŞÜK; else NORMAL
 */
export function bitumDepoDurumu(
  doluluk: number,
  kritikEsik: number,
  dusukEsik: number,
): "KRITIK" | "DUSUK" | "NORMAL" {
  if (doluluk <= kritikEsik) return "KRITIK";
  if (doluluk <= dusukEsik) return "DUSUK";
  return "NORMAL";
}

/** Alış maliyeti = miktar * fiyat */
export function bitumAlisMaliyeti(miktarTon: number, fiyatTon: number): number {
  return miktarTon * fiyatTon;
}

/**
 * Taşıma: varış maliyeti/ton = kaynakOrtFiyat + tasimaMaliyeti/miktar
 * Excel L: =K+J/F
 */
export function bitumVarisMaliyetiTon(
  kaynakOrtFiyat: number,
  tasimaMaliyeti: number,
  miktarTon: number,
): number {
  if (miktarTon <= 0) return kaynakOrtFiyat;
  return kaynakOrtFiyat + tasimaMaliyeti / miktarTon;
}

/**
 * Bitüm Alış toplam maliyet (M): Alış → H; Taşıma → F*L
 * Excel M: =IF(B="Alış",H,IF(B="Taşıma",F*L,""))
 */
export function bitumToplamMaliyet(
  tip: "ALIS" | "TASIMA" | "KULLANIM",
  alisMaliyeti: number | null,
  miktarTon: number,
  varisMaliyetiTon: number | null,
): number | null {
  if (tip === "ALIS") return alisMaliyeti;
  if (tip === "TASIMA") {
    if (varisMaliyetiTon == null) return null;
    return miktarTon * varisMaliyetiTon;
  }
  return null;
}

/**
 * Kiralık tanker stok — Ayarlar_Depo D18:
 * =SUMIFS(Alış)-SUMIFS(Taşıma kaynak)
 */
export function bitumKiralikStok(alisTon: number, tasimaCikisTon: number): number {
  return alisTon - tasimaCikisTon;
}

/**
 * Ana depo stok — Ayarlar_Depo D20:
 * =SUMIFS(Taşıma hedef)-SUMIFS(Kullanım)
 */
export function bitumAnaDepoStok(tasimaGirisTon: number, kullanimTon: number): number {
  return tasimaGirisTon - kullanimTon;
}

/**
 * Bitum sadece stok amaçlı — Kiralık:
 * =SUMIFS(Kiralığa Giriş)-SUMIFS(Kiralıktan Ana Depoya Transfer)
 */
export function bitumBasitKiralikStok(girisTon: number, transferTon: number): number {
  return girisTon - transferTon;
}

/**
 * Bitum sadece stok amaçlı — Ana depo:
 * =SUMIFS(Transfer)-SUMIFS(Sahaya Çıkış)
 */
export function bitumBasitAnaDepoStok(transferTon: number, sahayaCikisTon: number): number {
  return transferTon - sahayaCikisTon;
}

/** Özet B9: ort. alış fiyatı = toplam alış maliyet / toplam alış ton */
export function bitumOrtAlisFiyati(toplamMaliyet: number, toplamTon: number): number | null {
  if (toplamTon <= 0) return null;
  return toplamMaliyet / toplamTon;
}

/** Özet B12: ort. varış maliyeti = SUM(M taşıma)/SUM(F taşıma) */
export function bitumOrtVarisMaliyeti(
  toplamTasimaMaliyet: number,
  toplamTasimaTon: number,
): number | null {
  if (toplamTasimaTon <= 0) return null;
  return toplamTasimaMaliyet / toplamTasimaTon;
}

/**
 * Özet uyarı A15:
 * =IF(COUNTIF(KRİTİK)>0,"⚠ DİKKAT: Kritik seviyede depo var!","Tüm depolar normal/düşük seviyede.")
 */
export function bitumKritikUyari(kritikDepoSayisi: number): string {
  return kritikDepoSayisi > 0
    ? "⚠ DİKKAT: Kritik seviyede depo var!"
    : "Tüm depolar normal/düşük seviyede.";
}

/**
 * Agrega Özet Rapor pay: =aşamaBirim / toplamBirim
 * Excel: =B6/'Maliyet Hesaplama'!C29
 */
export function agregaAsamaPayi(asamaBirim: number, toplamBirim: number): number {
  if (toplamBirim <= 0) return 0;
  return asamaBirim / toplamBirim;
}

/**
 * Agrega proje özet: yıllık üretim = günlük × çalışma günü
 * Excel C7: =Parametreler!C10*Parametreler!C11
 */
export function agregaYillikUretim(gunlukHedefTon: number, yillikCalismaGun: number): number {
  return gunlukHedefTon * yillikCalismaGun;
}

/** Aylık maliyet projeksiyonu: günlük toplam × (yıllık gün / 12) */
export function agregaAylikMaliyet(gunlukMaliyet: number, yillikCalismaGun: number): number {
  return gunlukMaliyet * (yillikCalismaGun / 12);
}

/** Yıllık maliyet: günlük toplam × yıllık gün */
export function agregaYillikMaliyet(gunlukMaliyet: number, yillikCalismaGun: number): number {
  return gunlukMaliyet * yillikCalismaGun;
}

/**
 * Stok payı: =stokHedefi / SUM(stokHedefleri)
 * Excel I13: =IFERROR(C13/SUM(C$13:C$16),0)
 */
export function agregaStokPayi(stokHedefi: number, toplamStokHedefi: number): number {
  if (toplamStokHedefi <= 0) return 0;
  return stokHedefi / toplamStokHedefi;
}

/**
 * Araç Özet Panel F26: toplam operasyon maliyeti = bakım + yakıt
 * Excel: =SUM(Bakım!H)+SUM(Yakıt!H)
 */
export function toplamOperasyonMaliyeti(bakimToplam: number, yakitToplam: number): number {
  return bakimToplam + yakitToplam;
}
