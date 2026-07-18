/**
 * Excel formüllerinin birebir TypeScript karşılıkları.
 * Her fonksiyonun başında kaynak Excel formülü belirtilmiştir.
 * Saatler "HH:mm" biçiminde string alınır.
 */

/** "HH:mm" → günün kesri (Excel saat değeri gibi, 0-1 arası) */
export function saatKesri(saat: string): number {
  const [h, m] = saat.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Geçersiz saat: ${saat}`);
  }
  return (h + m / 60) / 24;
}

/**
 * Personel normal çalışma saati.
 * Excel (Personel Günlük Takip H sütunu):
 *   =MAX(0, (MIN(17:00,çıkış)-MAX(08:00,giriş))*24 - MAX(0,(MIN(13:00,çıkış)-MAX(12:00,giriş))*24))
 * 08:00-17:00 aralığındaki çalışma; 12:00-13:00 öğle molası düşülür.
 */
export function normalSaatHesapla(giris: string, cikis: string): number {
  const g = saatKesri(giris);
  const c = saatKesri(cikis);
  const calisilan = Math.max(0, (Math.min(17 / 24, c) - Math.max(8 / 24, g)) * 24);
  const mola = Math.max(0, (Math.min(13 / 24, c) - Math.max(12 / 24, g)) * 24);
  return Math.max(0, calisilan - mola);
}

/**
 * Personel fazla mesai saati.
 * Excel (I sütunu): =MAX(0,(çıkış-17:00)*24) — 17:00 sonrası.
 */
export function mesaiSaatHesapla(_giris: string, cikis: string): number {
  const c = saatKesri(cikis);
  return Math.max(0, (c - 17 / 24) * 24);
}

/** Toplam saat = normal + mesai (Excel J sütunu) */
export function toplamSaatHesapla(giris: string, cikis: string): number {
  return normalSaatHesapla(giris, cikis) + mesaiSaatHesapla(giris, cikis);
}

/**
 * Araç günlük çalışma saati — gece devrini destekler.
 * Excel (Araç Günlük Takip J sütunu):
 *   =IF(çıkış>giriş,(çıkış-giriş)*24,(1+çıkış-giriş)*24)
 */
export function aracCalismaSaatiHesapla(giris: string, cikis: string): number {
  const g = saatKesri(giris);
  const c = saatKesri(cikis);
  return c > g ? (c - g) * 24 : (1 + c - g) * 24;
}

/**
 * Görev süresi (saat) — Çıkış-Giriş Takip I sütunu:
 *   =MOD(TIMEVALUE(dönüş)-TIMEVALUE(çıkış),1)*24
 * Tarihli varyant: tam Date çifti verilirse milisaniyeden hesaplanır.
 */
export function gorevSuresiSaat(cikisSaati: string, donusSaati: string): number {
  const c = saatKesri(cikisSaati);
  const d = saatKesri(donusSaati);
  return ((d - c + 1) % 1) * 24;
}

export function gorevSuresiSaatTarihli(cikis: Date, giris: Date): number {
  return Math.max(0, (giris.getTime() - cikis.getTime()) / 3_600_000);
}

/** KM farkı (Çıkış-Giriş Takip L sütunu): =girişKm-çıkışKm */
export function kmFarki(kmCikis: number, kmGiris: number): number {
  return kmGiris - kmCikis;
}

/** Yakıt toplam tutarı (Yakıt Takip H sütunu): =litre*birimFiyat */
export function yakitTutari(litre: number, birimFiyat: number): number {
  return Math.round(litre * birimFiyat * 100) / 100;
}

/**
 * Şikayet numarası. Excel: ="ŞKY-"&TEXT(sıra,"0000")
 * Sistemde yıllık seri: ŞKY-2026-0001
 */
export function sikayetNoUret(yil: number, sira: number): string {
  return `ŞKY-${yil}-${String(sira).padStart(4, "0")}`;
}

/** Görev numarası: GRV-2026-0001 */
export function gorevNoUret(yil: number, sira: number): string {
  return `GRV-${yil}-${String(sira).padStart(4, "0")}`;
}
