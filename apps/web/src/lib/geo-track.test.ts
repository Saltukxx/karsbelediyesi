import { describe, expect, it } from "vitest";
import {
  duraklamaBul,
  hizIstatistik,
  izMesafeKm,
  mesafeM,
  ortPingAraligiSn,
  pointToSegmentMeters,
  rotaGirisCikis,
  rotaKapsama,
  rotaUyum,
  rotaYogunlastir,
  rotayaUzaklikM,
  sapmaBul,
  veriBoslukBul,
  type IzNokta,
  type LatLng,
} from "./geo-track";

// Kars merkezi civarı: 1° lat ≈ 111.2 km, 1° lng ≈ 84.5 km (cos 40.6°)
const LAT0 = 40.6;
const LNG0 = 43.09;
/** Metre → derece (yaklaşık, test amaçlı) */
const M_LAT = 1 / 111200;
const M_LNG = 1 / (111200 * Math.cos((LAT0 * Math.PI) / 180));

/** Batı-doğu düz rota: 1 km */
const ROTA: LatLng[] = [
  [LAT0, LNG0],
  [LAT0, LNG0 + 1000 * M_LNG],
];

function iz(
  metreDogu: number,
  metreKuzey: number,
  dakika: number,
  hiz: number | null = null,
): IzNokta {
  return {
    lat: LAT0 + metreKuzey * M_LAT,
    lng: LNG0 + metreDogu * M_LNG,
    zamanMs: Date.UTC(2026, 0, 1, 8, 0) + dakika * 60000,
    hiz,
  };
}

describe("mesafe hesapları", () => {
  it("mesafeM ~1000 m doğru", () => {
    const d = mesafeM(LAT0, LNG0, LAT0, LNG0 + 1000 * M_LNG);
    expect(d).toBeGreaterThan(980);
    expect(d).toBeLessThan(1020);
  });

  it("pointToSegmentMeters dik mesafe", () => {
    // Rota ortasının 100 m kuzeyi
    const d = pointToSegmentMeters(
      [LAT0 + 100 * M_LAT, LNG0 + 500 * M_LNG],
      ROTA[0],
      ROTA[1],
    );
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });

  it("pointToSegmentMeters segment ucundan ötesi uç noktaya göre", () => {
    // Rota bitişinin 200 m doğusu
    const d = pointToSegmentMeters([LAT0, LNG0 + 1200 * M_LNG], ROTA[0], ROTA[1]);
    expect(d).toBeGreaterThan(180);
    expect(d).toBeLessThan(220);
  });

  it("rotayaUzaklikM en yakın segmenti bulur", () => {
    const lRota: LatLng[] = [
      [LAT0, LNG0],
      [LAT0, LNG0 + 1000 * M_LNG],
      [LAT0 + 1000 * M_LAT, LNG0 + 1000 * M_LNG],
    ];
    // İkinci segmentin 50 m batısı
    const d = rotayaUzaklikM([LAT0 + 500 * M_LAT, LNG0 + 950 * M_LNG], lRota);
    expect(d).toBeGreaterThan(40);
    expect(d).toBeLessThan(60);
  });
});

describe("rotaYogunlastir", () => {
  it("1 km segmenti ~25 m aralıklı noktalara böler", () => {
    const noktalar = rotaYogunlastir(ROTA, 25);
    expect(noktalar.length).toBeGreaterThan(35);
    expect(noktalar.length).toBeLessThan(50);
  });
});

describe("rotaKapsama", () => {
  it("rota boyunca giden iz tam kapsama verir", () => {
    const izler = Array.from({ length: 21 }, (_, i) => iz(i * 50, 0, i));
    const s = rotaKapsama(ROTA, izler, 60);
    expect(s.kapsamaYuzde).toBeGreaterThan(95);
    expect(s.eksikSegmentler).toHaveLength(0);
  });

  it("yarıda bırakılan rota ~%50 kapsama + eksik segment", () => {
    const izler = Array.from({ length: 11 }, (_, i) => iz(i * 50, 0, i)); // ilk 500 m
    const s = rotaKapsama(ROTA, izler, 60);
    expect(s.kapsamaYuzde).toBeGreaterThan(40);
    expect(s.kapsamaYuzde).toBeLessThan(70);
    expect(s.eksikSegmentler.length).toBeGreaterThan(0);
  });

  it("iz yoksa %0", () => {
    const s = rotaKapsama(ROTA, [], 60);
    expect(s.kapsamaYuzde).toBe(0);
    expect(s.eksikSegmentler).toHaveLength(1);
  });
});

describe("rotaUyum ve sapmaBul", () => {
  it("rotada kalan iz %100 uyum", () => {
    const izler = Array.from({ length: 11 }, (_, i) => iz(i * 100, 10, i));
    const s = rotaUyum(ROTA, izler, 60);
    expect(s.uyumYuzde).toBe(100);
    expect(s.maxSapmaM).toBeLessThan(20);
  });

  it("rotadan çıkan iz düşük uyum + sapma olayı", () => {
    // 0-3. dk rotada, 4-8. dk 300 m kuzeyde, 9-10. dk rotada
    const izler = [
      iz(0, 0, 0),
      iz(100, 0, 1),
      iz(200, 0, 2),
      iz(300, 0, 3),
      iz(350, 300, 4),
      iz(400, 300, 5),
      iz(450, 320, 6),
      iz(500, 300, 7),
      iz(550, 300, 8),
      iz(600, 0, 9),
      iz(700, 0, 10),
    ];
    const uyum = rotaUyum(ROTA, izler, 60);
    expect(uyum.uyumYuzde).toBeLessThan(70);
    expect(uyum.maxSapmaM).toBeGreaterThan(250);

    const sapmalar = sapmaBul(ROTA, izler, 60, 2);
    expect(sapmalar).toHaveLength(1);
    expect(sapmalar[0].sureDk).toBeCloseTo(4, 0);
    expect(sapmalar[0].maxMesafeM).toBeGreaterThan(250);
    expect(sapmalar[0].izler.length).toBe(5);
  });

  it("minDk altındaki kısa çıkış sapma sayılmaz", () => {
    const izler = [iz(0, 0, 0), iz(100, 300, 0.5), iz(200, 0, 1)];
    expect(sapmaBul(ROTA, izler, 60, 2)).toHaveLength(0);
  });
});

describe("duraklamaBul", () => {
  it("hız alanıyla 0 km/sa duraklaması bulunur ve rota üzerinde işaretlenir", () => {
    const izler = [
      iz(0, 0, 0, 30),
      iz(200, 0, 1, 30),
      iz(400, 0, 2, 0),
      iz(400, 0, 3, 0),
      iz(400, 0, 4, 0),
      iz(400, 0, 5, 0),
      iz(600, 0, 6, 30),
    ];
    const d = duraklamaBul(izler, 3, ROTA, 60);
    expect(d).toHaveLength(1);
    expect(d[0].sureDk).toBeCloseTo(3, 0);
    expect(d[0].rotaUzerinde).toBe(true);
  });

  it("tek aykırı ping duraklamayı bölmez (GPS gürültü toleransı)", () => {
    const izler = [
      iz(400, 0, 0, 0),
      iz(400, 0, 1, 0),
      iz(400, 0, 2, 8), // aykırı
      iz(400, 0, 3, 0),
      iz(400, 0, 4, 0),
    ];
    const d = duraklamaBul(izler, 3);
    expect(d).toHaveLength(1);
    expect(d[0].sureDk).toBeCloseTo(4, 0);
  });

  it("hız alanı yokken hareketsizlikten duraklama türetilir", () => {
    const izler = [
      iz(0, 0, 0),
      iz(300, 0, 1),
      iz(300, 2, 2),
      iz(302, 0, 3),
      iz(300, 3, 4),
      iz(301, 0, 5),
      iz(600, 0, 6),
    ];
    const d = duraklamaBul(izler, 3);
    expect(d).toHaveLength(1);
    expect(d[0].sureDk).toBeGreaterThanOrEqual(3);
  });

  it("kısa duraklama minDk altında elenir", () => {
    const izler = [iz(0, 0, 0, 30), iz(200, 0, 1, 0), iz(200, 0, 2, 0), iz(400, 0, 3, 30)];
    expect(duraklamaBul(izler, 3)).toHaveLength(0);
  });
});

describe("veri kalitesi", () => {
  it("veriBoslukBul ping boşluğunu bulur", () => {
    const izler = [iz(0, 0, 0), iz(100, 0, 1), iz(500, 0, 12), iz(600, 0, 13)];
    const b = veriBoslukBul(izler, 5);
    expect(b).toHaveLength(1);
    expect(b[0].sureDk).toBeCloseTo(11, 0);
  });

  it("ortPingAraligiSn hesaplanır", () => {
    const izler = [iz(0, 0, 0), iz(100, 0, 1), iz(200, 0, 2)];
    expect(ortPingAraligiSn(izler)).toBe(60);
  });
});

describe("mesafe ve hız istatistikleri", () => {
  it("izMesafeKm toplam mesafe", () => {
    const izler = Array.from({ length: 11 }, (_, i) => iz(i * 100, 0, i));
    const km = izMesafeKm(izler);
    expect(km).toBeGreaterThan(0.9);
    expect(km).toBeLessThan(1.1);
  });

  it("izMesafeKm GPS sıçramasını ayıklar", () => {
    // 1. dk'da 10 km'lik imkansız atlama (600 km/sa)
    const izler = [iz(0, 0, 0), iz(10000, 0, 1), iz(10100, 0, 2)];
    const km = izMesafeKm(izler);
    expect(km).toBeLessThan(0.2);
  });

  it("hizIstatistik hiz alanından ortalama/maks", () => {
    const izler = [iz(0, 0, 0, 20), iz(100, 0, 1, 40), iz(200, 0, 2, 30)];
    const h = hizIstatistik(izler);
    expect(h.ortalamaKmh).toBe(30);
    expect(h.maxKmh).toBe(40);
  });

  it("hizIstatistik hiz alanı yokken mesafeden türetir", () => {
    // Dakikada 500 m = 30 km/sa
    const izler = [iz(0, 0, 0), iz(500, 0, 1), iz(1000, 0, 2)];
    const h = hizIstatistik(izler);
    expect(h.ortalamaKmh).toBeGreaterThan(27);
    expect(h.ortalamaKmh).toBeLessThan(33);
  });
});

describe("rotaGirisCikis", () => {
  it("buffer içindeki ilk/son ping zamanı", () => {
    const izler = [
      iz(-500, 500, 0), // rota dışı
      iz(0, 0, 5), // giriş
      iz(500, 0, 10),
      iz(1000, 0, 15), // son rota içi
      iz(1500, 500, 20), // rota dışı
    ];
    const g = rotaGirisCikis(ROTA, izler, 60);
    expect(g.girisMs).toBe(izler[1].zamanMs);
    expect(g.cikisMs).toBe(izler[3].zamanMs);
    expect(g.sureDk).toBe(10);
  });

  it("hiç girmemişse null", () => {
    const izler = [iz(0, 5000, 0), iz(100, 5000, 1)];
    const g = rotaGirisCikis(ROTA, izler, 60);
    expect(g.girisMs).toBeNull();
    expect(g.sureDk).toBeNull();
  });
});
