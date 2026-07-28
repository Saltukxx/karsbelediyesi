/**
 * GPS izi ↔ rota polyline karşılaştırma yardımcıları.
 * Saf fonksiyonlar — DB erişimi yok, unit test edilebilir.
 *
 * Koordinat konvansiyonu: [lat, lng] (Leaflet sırası, rota modelleriyle aynı).
 */

export type LatLng = [number, number];

export interface IzNokta {
  lat: number;
  lng: number;
  /** epoch ms */
  zamanMs: number;
  /** km/sa — kaynak vermediyse null */
  hiz: number | null;
}

export interface SapmaOlayi {
  baslangicMs: number;
  bitisMs: number;
  sureDk: number;
  maxMesafeM: number;
  /** En uzak nokta */
  lat: number;
  lng: number;
  /** Sapma sırasındaki iz parçası */
  izler: LatLng[];
}

export interface Duraklama {
  lat: number;
  lng: number;
  baslangicMs: number;
  bitisMs: number;
  sureDk: number;
  rotaUzerinde: boolean;
}

export interface VeriBoslugu {
  baslangicMs: number;
  bitisMs: number;
  sureDk: number;
}

/** GPS sıçraması sayılacak hız eşiği (km/sa) — üstü ayıklanır */
const HIZ_SICRAMA_KMH = 150;
/** Duraklama sayılan hız eşiği (km/sa) */
const DURAKLAMA_HIZ_KMH = 2;
/** hiz alanı yokken duraklama sayılan hareket eşiği (m) */
const DURAKLAMA_HAREKET_M = 15;

const DUNYA_YARICAP_M = 6371000;

/** Haversine mesafe (metre) */
export function mesafeM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * DUNYA_YARICAP_M * Math.asin(Math.sqrt(s));
}

/** Şehir ölçeğinde yeterli doğrulukta düzlem projeksiyonu (metre) */
function projeksiyon(refLat: number, p: LatLng): [number, number] {
  const x =
    ((p[1] * Math.PI) / 180) * DUNYA_YARICAP_M * Math.cos((refLat * Math.PI) / 180);
  const y = ((p[0] * Math.PI) / 180) * DUNYA_YARICAP_M;
  return [x, y];
}

/** Noktanın [a,b] doğru parçasına dik mesafesi (metre) */
export function pointToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const refLat = p[0];
  const [px, py] = projeksiyon(refLat, p);
  const [ax, ay] = projeksiyon(refLat, a);
  const [bx, by] = projeksiyon(refLat, b);
  const dx = bx - ax;
  const dy = by - ay;
  const uzunlukKare = dx * dx + dy * dy;
  if (uzunlukKare === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / uzunlukKare;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Noktanın rota polyline'ına en yakın mesafesi (metre) */
export function rotayaUzaklikM(p: LatLng, rota: LatLng[]): number {
  if (rota.length === 0) return Infinity;
  if (rota.length === 1) return mesafeM(p[0], p[1], rota[0][0], rota[0][1]);
  let min = Infinity;
  for (let i = 0; i < rota.length - 1; i++) {
    const d = pointToSegmentMeters(p, rota[i], rota[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Rota polyline'ını ~stepM aralıklı ara noktalarla yoğunlaştırır.
 * Kaba çizilmiş uzun segmentlerde kapsama hesabının yanlış pozitif
 * vermemesi için gerekir.
 */
export function rotaYogunlastir(rota: LatLng[], stepM = 25): LatLng[] {
  if (rota.length < 2) return [...rota];
  const sonuc: LatLng[] = [rota[0]];
  for (let i = 0; i < rota.length - 1; i++) {
    const [aLat, aLng] = rota[i];
    const [bLat, bLng] = rota[i + 1];
    const d = mesafeM(aLat, aLng, bLat, bLng);
    const adim = Math.max(1, Math.ceil(d / stepM));
    for (let j = 1; j <= adim; j++) {
      sonuc.push([aLat + ((bLat - aLat) * j) / adim, aLng + ((bLng - aLng) * j) / adim]);
    }
  }
  return sonuc;
}

export interface KapsamaSonuc {
  /** 0-100 */
  kapsamaYuzde: number;
  /** Kat edilmeyen rota bölümleri (yoğunlaştırılmış noktalardan) */
  eksikSegmentler: LatLng[][];
}

/**
 * Rotanın ne kadarının kat edildiği: yoğunlaştırılmış rota noktalarının
 * her biri için buffer içinde ≥1 ping var mı bakılır.
 */
export function rotaKapsama(
  rota: LatLng[],
  izler: IzNokta[],
  bufferM = 60,
): KapsamaSonuc {
  const noktalar = rotaYogunlastir(rota);
  if (noktalar.length === 0) return { kapsamaYuzde: 0, eksikSegmentler: [] };
  if (izler.length === 0) {
    return { kapsamaYuzde: 0, eksikSegmentler: noktalar.length > 1 ? [noktalar] : [] };
  }

  const kapli: boolean[] = noktalar.map((n) =>
    izler.some((iz) => mesafeM(n[0], n[1], iz.lat, iz.lng) <= bufferM),
  );

  const kapliSayi = kapli.filter(Boolean).length;
  const eksikSegmentler: LatLng[][] = [];
  let aktif: LatLng[] = [];
  for (let i = 0; i < noktalar.length; i++) {
    if (!kapli[i]) {
      aktif.push(noktalar[i]);
    } else if (aktif.length > 0) {
      if (aktif.length > 1) eksikSegmentler.push(aktif);
      aktif = [];
    }
  }
  if (aktif.length > 1) eksikSegmentler.push(aktif);

  return {
    kapsamaYuzde: Math.round((kapliSayi / noktalar.length) * 1000) / 10,
    eksikSegmentler,
  };
}

export interface UyumSonuc {
  /** Buffer içindeki ping oranı, 0-100 */
  uyumYuzde: number;
  ortSapmaM: number | null;
  maxSapmaM: number | null;
  /** Her ping'in rotaya uzaklığı (metre, iz sırasında) */
  mesafeler: number[];
}

/** Rotada kalma sadakati: her ping'in rotaya uzaklığı */
export function rotaUyum(rota: LatLng[], izler: IzNokta[], bufferM = 60): UyumSonuc {
  if (izler.length === 0) {
    return { uyumYuzde: 0, ortSapmaM: null, maxSapmaM: null, mesafeler: [] };
  }
  const mesafeler = izler.map((iz) => rotayaUzaklikM([iz.lat, iz.lng], rota));
  const icinde = mesafeler.filter((d) => d <= bufferM).length;
  return {
    uyumYuzde: Math.round((icinde / izler.length) * 1000) / 10,
    ortSapmaM: Math.round(mesafeler.reduce((a, b) => a + b, 0) / mesafeler.length),
    maxSapmaM: Math.round(Math.max(...mesafeler)),
    mesafeler,
  };
}

/**
 * Rota dışı olaylar: buffer dışında kalınan ardışık ping aralıkları
 * (≥ minDk sürenler) sapma olayı olarak kümelenir.
 */
export function sapmaBul(
  rota: LatLng[],
  izler: IzNokta[],
  bufferM = 60,
  minDk = 2,
): SapmaOlayi[] {
  if (izler.length === 0) return [];
  const mesafeler = izler.map((iz) => rotayaUzaklikM([iz.lat, iz.lng], rota));
  const olaylar: SapmaOlayi[] = [];
  let basIdx: number | null = null;

  const kapat = (sonIdx: number) => {
    if (basIdx === null) return;
    const grup = izler.slice(basIdx, sonIdx + 1);
    const grupMesafe = mesafeler.slice(basIdx, sonIdx + 1);
    const sureDk = (grup[grup.length - 1].zamanMs - grup[0].zamanMs) / 60000;
    if (sureDk >= minDk) {
      let maxIdx = 0;
      for (let i = 1; i < grupMesafe.length; i++) {
        if (grupMesafe[i] > grupMesafe[maxIdx]) maxIdx = i;
      }
      olaylar.push({
        baslangicMs: grup[0].zamanMs,
        bitisMs: grup[grup.length - 1].zamanMs,
        sureDk: Math.round(sureDk * 10) / 10,
        maxMesafeM: Math.round(grupMesafe[maxIdx]),
        lat: grup[maxIdx].lat,
        lng: grup[maxIdx].lng,
        izler: grup.map((iz) => [iz.lat, iz.lng] as LatLng),
      });
    }
    basIdx = null;
  };

  for (let i = 0; i < izler.length; i++) {
    if (mesafeler[i] > bufferM) {
      if (basIdx === null) basIdx = i;
    } else {
      kapat(i - 1);
    }
  }
  kapat(izler.length - 1);
  return olaylar;
}

/**
 * Duraklamalar: hız ≤ 2 km/sa (hiz alanı yoksa ardışık hareket < 15 m)
 * durumu ≥ minDk sürerse duraklama. Tek aykırı ping duraklamayı bölmez.
 */
export function duraklamaBul(
  izler: IzNokta[],
  minDk = 3,
  rota?: LatLng[],
  bufferM = 60,
): Duraklama[] {
  if (izler.length < 2) return [];

  // Her ping için "duruyor mu" işareti
  const duruyor: boolean[] = izler.map((iz, i) => {
    if (iz.hiz != null) return iz.hiz <= DURAKLAMA_HIZ_KMH;
    const onceki = izler[i - 1];
    if (!onceki) return false;
    return mesafeM(onceki.lat, onceki.lng, iz.lat, iz.lng) <= DURAKLAMA_HAREKET_M;
  });

  // 1 ping tolerans: dur-git-dur tek aykırı ping'i düzelt (GPS gürültüsü)
  for (let i = 1; i < duruyor.length - 1; i++) {
    if (!duruyor[i] && duruyor[i - 1] && duruyor[i + 1]) duruyor[i] = true;
  }

  const sonuc: Duraklama[] = [];
  let bas: number | null = null;
  const kapat = (son: number) => {
    if (bas === null) return;
    const grup = izler.slice(bas, son + 1);
    const sureDk = (grup[grup.length - 1].zamanMs - grup[0].zamanMs) / 60000;
    if (sureDk >= minDk) {
      const lat = grup.reduce((a, iz) => a + iz.lat, 0) / grup.length;
      const lng = grup.reduce((a, iz) => a + iz.lng, 0) / grup.length;
      sonuc.push({
        lat,
        lng,
        baslangicMs: grup[0].zamanMs,
        bitisMs: grup[grup.length - 1].zamanMs,
        sureDk: Math.round(sureDk * 10) / 10,
        rotaUzerinde: rota ? rotayaUzaklikM([lat, lng], rota) <= bufferM : false,
      });
    }
    bas = null;
  };

  for (let i = 0; i < izler.length; i++) {
    if (duruyor[i]) {
      if (bas === null) bas = i;
    } else {
      kapat(i - 1);
    }
  }
  kapat(izler.length - 1);
  return sonuc;
}

/** Ping gelmeyen ≥ minDk aralıklar */
export function veriBoslukBul(izler: IzNokta[], minDk = 5): VeriBoslugu[] {
  const sonuc: VeriBoslugu[] = [];
  for (let i = 1; i < izler.length; i++) {
    const farkDk = (izler[i].zamanMs - izler[i - 1].zamanMs) / 60000;
    if (farkDk >= minDk) {
      sonuc.push({
        baslangicMs: izler[i - 1].zamanMs,
        bitisMs: izler[i].zamanMs,
        sureDk: Math.round(farkDk * 10) / 10,
      });
    }
  }
  return sonuc;
}

/** Ardışık ping'ler arası ortalama süre (sn) */
export function ortPingAraligiSn(izler: IzNokta[]): number | null {
  if (izler.length < 2) return null;
  const toplamSn = (izler[izler.length - 1].zamanMs - izler[0].zamanMs) / 1000;
  return Math.round((toplamSn / (izler.length - 1)) * 10) / 10;
}

/** İz uzunluğu (km) — GPS sıçramaları (>150 km/sa ima eden atlamalar) ayıklanır */
export function izMesafeKm(izler: IzNokta[]): number {
  let toplamM = 0;
  for (let i = 1; i < izler.length; i++) {
    const d = mesafeM(izler[i - 1].lat, izler[i - 1].lng, izler[i].lat, izler[i].lng);
    const sureSaat = (izler[i].zamanMs - izler[i - 1].zamanMs) / 3600000;
    if (sureSaat > 0 && d / 1000 / sureSaat > HIZ_SICRAMA_KMH) continue;
    toplamM += d;
  }
  return Math.round((toplamM / 1000) * 100) / 100;
}

export interface HizIstatistik {
  ortalamaKmh: number | null;
  maxKmh: number | null;
}

/**
 * Ortalama/maks hız: hiz alanı olan ping'ler varsa onlardan,
 * yoksa ardışık ping mesafe/süresinden türetilir. >150 km/sa ayıklanır.
 */
export function hizIstatistik(izler: IzNokta[]): HizIstatistik {
  const bildirilen = izler
    .map((iz) => iz.hiz)
    .filter((h): h is number => h != null && h >= 0 && h <= HIZ_SICRAMA_KMH);
  let hizlar: number[];
  if (bildirilen.length > 0) {
    hizlar = bildirilen;
  } else {
    hizlar = [];
    for (let i = 1; i < izler.length; i++) {
      const sureSaat = (izler[i].zamanMs - izler[i - 1].zamanMs) / 3600000;
      if (sureSaat <= 0) continue;
      const kmh =
        mesafeM(izler[i - 1].lat, izler[i - 1].lng, izler[i].lat, izler[i].lng) /
        1000 /
        sureSaat;
      if (kmh <= HIZ_SICRAMA_KMH) hizlar.push(kmh);
    }
  }
  if (hizlar.length === 0) return { ortalamaKmh: null, maxKmh: null };
  return {
    ortalamaKmh:
      Math.round((hizlar.reduce((a, b) => a + b, 0) / hizlar.length) * 10) / 10,
    maxKmh: Math.round(Math.max(...hizlar) * 10) / 10,
  };
}

export interface GirisCikis {
  girisMs: number | null;
  cikisMs: number | null;
  sureDk: number | null;
}

/** Rotaya (buffer içine) ilk giriş / son çıkış zamanı */
export function rotaGirisCikis(
  rota: LatLng[],
  izler: IzNokta[],
  bufferM = 60,
): GirisCikis {
  let giris: number | null = null;
  let cikis: number | null = null;
  for (const iz of izler) {
    if (rotayaUzaklikM([iz.lat, iz.lng], rota) <= bufferM) {
      if (giris === null) giris = iz.zamanMs;
      cikis = iz.zamanMs;
    }
  }
  return {
    girisMs: giris,
    cikisMs: cikis,
    sureDk:
      giris !== null && cikis !== null
        ? Math.round(((cikis - giris) / 60000) * 10) / 10
        : null,
  };
}
