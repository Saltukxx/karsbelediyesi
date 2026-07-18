import { describe, expect, it } from "vitest";
import {
  gercekTuketim,
  tuketimDurumu,
  mevcutStok,
  stokDurumu,
  aylikNetHareket,
  ayAdiFromDate,
  sayacFarkiMaxMin,
  ortBirimFiyat,
  suCimentoOrani,
  toplamAgregaKg,
  toplamKarisimKg,
  yogunlukKontrolu,
  betonUretimMalzeme,
  betonGuncelStok,
  betonStokDurumu,
  agregaFizikselMaliyet,
  agregaProjeMaliyet,
  agregaAsamaPayi,
  agregaYillikUretim,
  agregaAylikMaliyet,
  agregaYillikMaliyet,
  agregaStokPayi,
  bitumSeferMaliyeti,
  bitumTonTasima,
  bitumTirSefer,
  bitumDoluluk,
  bitumDepoDurumu,
  bitumAlisMaliyeti,
  bitumVarisMaliyetiTon,
  bitumToplamMaliyet,
  bitumKiralikStok,
  bitumAnaDepoStok,
  bitumBasitKiralikStok,
  bitumBasitAnaDepoStok,
  bitumOrtAlisFiyati,
  bitumOrtVarisMaliyeti,
  bitumKritikUyari,
  toplamOperasyonMaliyeti,
} from "./extended-calculations";

describe("Akaryakıt tüketim", () => {
  it("lt/100km", () => {
    expect(gercekTuketim(32, 100, "KM")).toBeCloseTo(32);
  });
  it("lt/saat", () => {
    expect(gercekTuketim(18, 2, "SAAT")).toBeCloseTo(9);
  });
  it("durum eşikleri", () => {
    expect(tuketimDurumu(32, 32)).toBe("NORMAL");
    expect(tuketimDurumu(34, 32)).toBe("DIKKAT");
    expect(tuketimDurumu(38, 32)).toBe("YUKSEK");
  });
  it("sayac farkı MAX-MIN", () => {
    expect(sayacFarkiMaxMin([1000, 1200, 1100])).toBe(200);
    expect(sayacFarkiMaxMin([50])).toBe(0);
  });
  it("ort birim fiyat", () => {
    expect(ortBirimFiyat(8010, 180)).toBeCloseTo(44.5);
    expect(ortBirimFiyat(100, 0)).toBeNull();
  });
  it("ay adı", () => {
    expect(ayAdiFromDate(new Date(2026, 2, 15))).toBe("Mart");
  });
});

describe("Malzeme stok", () => {
  it("mevcut stok ve aylık net", () => {
    expect(mevcutStok(100, 20)).toBe(80);
    expect(aylikNetHareket(50, 30)).toBe(20);
  });
  it("durum (×1.3)", () => {
    expect(stokDurumu(40, 50)).toBe("KRITIK");
    expect(stokDurumu(55, 50)).toBe("DIKKAT");
    expect(stokDurumu(80, 50)).toBe("NORMAL");
  });
});

describe("Beton", () => {
  it("C20 oranları Excel örneği", () => {
    expect(suCimentoOrani(180, 300)).toBeCloseTo(0.6);
    expect(toplamAgregaKg(670, 190, 480, 575)).toBe(1915);
    expect(toplamKarisimKg(300, 670, 190, 480, 575, 180, 3)).toBe(2398);
    expect(yogunlukKontrolu(2398)).toBe("NORMAL (1 m3)");
    expect(yogunlukKontrolu(2200)).toBe("KONTROL ET");
    expect(yogunlukKontrolu(2600)).toBe("KONTROL ET");
    expect(betonUretimMalzeme(2, 300)).toBe(600);
  });
  it("stok = başlangıç+giriş−üretim · KRITIK/AZ/YETERLI ×1.5", () => {
    expect(betonGuncelStok(100, 50, 30)).toBe(120);
    expect(betonStokDurumu(0, 100)).toBe("KRITIK");
    expect(betonStokDurumu(120, 100)).toBe("AZ"); // <= 150
    expect(betonStokDurumu(200, 100)).toBe("YETERLI");
  });
});

describe("Agrega fiziksel (Excel 2)", () => {
  it("örnek parametrelerle ~54 TL/ton", () => {
    const r = agregaFizikselMaliyet({
      mesafeKm: 3,
      motorinFiyat: 45,
      elektrikFiyat: 3.2,
      sokumYakitLtSaat: 18,
      sokumAmortisman: 350,
      sokumKapasiteTonSaat: 45,
      yuklemeYakitLtSaat: 16,
      yuklemeAmortisman: 300,
      yuklemeKapasiteTonSaat: 90,
      kamyonKapasiteTon: 20,
      kamyonYakitLtKm: 0.42,
      seferHizKmSaat: 30,
      yuklemeBosaltmaDk: 10,
      kamyonAmortisman: 180,
      kiriciKw: 400,
      yukFaktoru: 0.75,
      kiriciKapasiteTonSaat: 120,
      oran05: 0.3,
      oran512: 0.25,
      oran1219: 0.25,
      oran1932: 0.2,
      donemUretimTon: 5000,
    });
    expect(r.asama1).toBeCloseTo(25.777, 2);
    expect(r.asama2).toBeCloseTo(11.333, 2);
    expect(r.asama3).toBeCloseTo(8.97, 2);
    expect(r.asama4).toBeCloseTo(8, 2);
    expect(r.toplamBirim).toBeCloseTo(54.081, 2);
    expect(agregaAsamaPayi(r.asama1, r.toplamBirim)).toBeCloseTo(0.4767, 3);
  });
});

describe("Agrega proje", () => {
  it("39.7 TL/ton + projeksiyonlar", () => {
    const r = agregaProjeMaliyet({
      gunlukHedefTon: 500,
      kiriciYakitTon: 7.5,
      kiriciBakimTon: 3.2,
      yukleyiciYakitTon: 6.8,
      yukleyiciBakimTon: 2.5,
      nakliyeYakitTon: 10,
      elekElektrikTon: 2.5,
      elemeBakimTon: 6,
      yikamaSuTon: 1.2,
      genelGiderTon: 0,
      boyutlar: [
        { boyut: "0-5", oran: 0.3, satisFiyati: 180, stokHedefi: 1000 },
        { boyut: "5-12", oran: 0.25, satisFiyati: 220, stokHedefi: 1000 },
        { boyut: "12-19", oran: 0.25, satisFiyati: 240, stokHedefi: 1000 },
        { boyut: "19-32", oran: 0.2, satisFiyati: 250, stokHedefi: 1000 },
      ],
    });
    expect(r.birim).toBeCloseTo(39.7, 1);
    expect(r.gunluk).toBeCloseTo(19850, 0);
    expect(agregaYillikUretim(500, 250)).toBe(125000);
    expect(agregaAylikMaliyet(19850, 250)).toBeCloseTo(19850 * (250 / 12), 0);
    expect(agregaYillikMaliyet(19850, 250)).toBe(19850 * 250);
    expect(agregaStokPayi(1000, 4000)).toBeCloseTo(0.25);
  });
});

describe("Bitüm", () => {
  it("sefer / ton / tir / doluluk / özet", () => {
    expect(bitumSeferMaliyeti(185, 45)).toBe(16650);
    expect(bitumTonTasima(16650, 30)).toBe(555);
    expect(bitumTirSefer(60, 30)).toBe(2);
    expect(bitumDoluluk(40, 80)).toBeCloseTo(0.5);
    expect(bitumDepoDurumu(0.15, 0.2, 0.4)).toBe("KRITIK");
    expect(bitumAlisMaliyeti(15, 17814)).toBe(267210);
    expect(bitumVarisMaliyetiTon(18358, 16650, 15)).toBeCloseTo(19468, 0);
    expect(bitumToplamMaliyet("ALIS", 267210, 15, null)).toBe(267210);
    expect(bitumToplamMaliyet("TASIMA", null, 15, 19468)).toBeCloseTo(292020, 0);
    expect(bitumKiralikStok(100, 40)).toBe(60);
    expect(bitumAnaDepoStok(40, 10)).toBe(30);
    expect(bitumBasitKiralikStok(50, 20)).toBe(30);
    expect(bitumBasitAnaDepoStok(20, 5)).toBe(15);
    expect(bitumOrtAlisFiyati(5770165, 305)).toBeCloseTo(18918.57, 1);
    expect(bitumOrtVarisMaliyeti(1000, 10)).toBe(100);
    expect(bitumKritikUyari(2)).toContain("Kritik");
    expect(bitumKritikUyari(0)).toContain("normal");
  });
});

describe("Operasyon özeti", () => {
  it("bakım + yakıt", () => {
    expect(toplamOperasyonMaliyeti(1000, 2500)).toBe(3500);
  });
});
