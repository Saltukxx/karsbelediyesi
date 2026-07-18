/**
 * Excel dosyalarından birebir çıkarılan tanım listeleri.
 * Kaynak: "Cagri Yonetim Sistemi", "Araç ve İş Makinesi Envanteri",
 * "Yeni Araç Havuz Takip", "İş Makineleri Bakim Kontrol", "Günlük Çalışma Takibi"
 */

// ── LİSTELER sayfası: 23 mahalle ────────────────────────────────────────────
export const MAHALLELER = [
  "30 Ekim Mahallesi",
  "Alpaslan Mahallesi",
  "Atatürk Mahallesi",
  "Aydınlıkevler Mahallesi",
  "Bahçelievler Mahallesi",
  "Bayrampaşa Mahallesi",
  "Bülbül Mahallesi",
  "Cumhuriyet Mahallesi",
  "Fevzi Çakmak Mahallesi",
  "Hafızpaşa Mahallesi",
  "Halitpaşa Mahallesi",
  "İstasyon Mahallesi",
  "Kaleiçi Mahallesi",
  "Karadağ Mahallesi",
  "Merkez",
  "Ortakapı Mahallesi",
  "Örenek Mahallesi",
  "Paşaçayır Mahallesi",
  "Sukapı Mahallesi",
  "Şehitler Mahallesi",
  "Yenimahalle",
  "Yenişehir Mahallesi",
  "Yusufpaşa Mahallesi",
] as const;

// ── Müdürlükler: 3 Excel'deki listelerin birleşimi ─────────────────────────
export const MUDURLUKLER = [
  { name: "Fen İşleri Müdürlüğü", shortName: "Fen İşleri" },
  { name: "Su ve Kanalizasyon İşleri Müdürlüğü", shortName: "Su ve Kan." },
  { name: "Temizlik İşleri Müdürlüğü", shortName: "Temizlik" },
  { name: "Zabıta Müdürlüğü", shortName: "Zabıta" },
  { name: "Park ve Bahçeler Müdürlüğü", shortName: "Park ve Bah." },
  { name: "Ulaşım Hizmetleri Müdürlüğü", shortName: "Ulaşım" },
  { name: "Karsbel Müdürlüğü", shortName: "Karsbel" },
  { name: "Yazı İşleri Müdürlüğü", shortName: "Yazı İşleri" },
  { name: "Kültür ve Sosyal İşler Müdürlüğü", shortName: "Kültür/Sos." },
  { name: "Diğer", shortName: "Diğer" },
] as const;

// ── Şikayet türleri (10) + varsayılan müdürlük eşlemesi (AI yönlendirme) ────
export const SIKAYET_TURLERI = [
  { name: "Logar Tıkanıklığı", defaultDepartment: "Su ve Kanalizasyon İşleri Müdürlüğü" },
  { name: "Vidanjör Talebi", defaultDepartment: "Su ve Kanalizasyon İşleri Müdürlüğü" },
  { name: "Su Arızası", defaultDepartment: "Su ve Kanalizasyon İşleri Müdürlüğü" },
  { name: "Yol Bozukluğu", defaultDepartment: "Fen İşleri Müdürlüğü" },
  { name: "Çöp Toplama", defaultDepartment: "Temizlik İşleri Müdürlüğü" },
  { name: "Park Bakım", defaultDepartment: "Park ve Bahçeler Müdürlüğü" },
  { name: "Zabıta Şikayeti", defaultDepartment: "Zabıta Müdürlüğü" },
  { name: "Ulaşım Sorunu", defaultDepartment: "Ulaşım Hizmetleri Müdürlüğü" },
  { name: "Asfalt Onarım", defaultDepartment: "Fen İşleri Müdürlüğü" },
  { name: "Diğer", defaultDepartment: "Fen İşleri Müdürlüğü" },
] as const;

// ── Araç cinsleri (Araç Havuzu dropdown) ────────────────────────────────────
export const ARAC_CINSLERI = [
  "Loder",
  "Ekskavatör",
  "JCB",
  "Kamyon",
  "Transit",
  "Lowbet",
  "Vidanjör",
  "Oto Karasfalt Finişeri",
  "Greyder",
  "Silindir",
  "Diğer",
] as const;

// ── Onaylayanlar (Excel KAPALI İŞLER / RAPORLAMA dropdown) ──────────────────
export const ONAYLAYANLAR = ["Kadim Işık", "Bülent Toraman", "Ötüken Senger"] as const;

// ── Etiket eşlemeleri (enum → Türkçe görünen ad) ────────────────────────────
export const ONCELIK_LABELS = {
  NORMAL: "Normal",
  ACIL: "Acil",
  COK_ACIL: "Çok Acil",
} as const;

export const SIKAYET_DURUM_LABELS = {
  ACIK: "Açık",
  DEVAM_EDIYOR: "Devam Ediyor",
  KAPATILDI: "Kapatıldı",
  IPTAL: "İptal",
} as const;

export const ENVANTER_DURUM_LABELS = {
  AKTIF: "Aktif",
  BAKIMDA: "Bakımda",
  ARIZALI: "Arızalı",
  HURDAYA_AYRILDI: "Hurdaya Ayrıldı",
} as const;

export const OPERASYON_DURUM_LABELS = {
  MUSAIT: "✅ Müsait",
  GOREVDE: "🔴 Görevde",
  BAKIMDA: "🔧 Bakımda",
  ARIZALI: "⛔ Arızalı",
  PLANLI_BAKIM: "📋 Planlı Bakım",
} as const;

export const YAKIT_TIPI_LABELS = {
  DIZEL: "Dizel",
  BENZIN: "Benzin",
  LPG: "LPG",
  ELEKTRIK: "Elektrik",
  HIBRIT: "Hibrit",
  DIGER: "Diğer",
} as const;

export const YAKIT_TURU_LABELS = {
  MOTORIN: "Motorin",
  BENZIN: "Benzin",
  LPG: "LPG",
  ELEKTRIK: "Elektrik",
  DIGER: "Diğer",
} as const;

export const BAKIM_TURU_LABELS = {
  PERIYODIK: "Periyodik Bakım",
  BUYUK_BAKIM: "Büyük Bakım",
  ARIZA_ONARIMI: "Arıza Onarımı",
  LASTIK: "Lastik",
  YAG_DEGISIMI: "Yağ Değişimi",
  DIGER: "Diğer",
} as const;

export const BAKIM_DURUM_LABELS = {
  TAMAMLANDI: "Tamamlandı",
  DEVAM_EDIYOR: "Devam Ediyor",
  PLANLANDI: "Planlandı",
} as const;

export const GOREV_DURUM_LABELS = {
  PLANLANDI: "⏳ Planlandı",
  DEVAM_EDIYOR: "🔄 Devam Ediyor",
  TAMAMLANDI: "✅ Tamamlandı",
  IPTAL_EDILDI: "❌ İptal Edildi",
} as const;

export const PERSONEL_DURUM_LABELS = {
  AKTIF: "Aktif",
  IZINLI: "İzinli",
  RAPORLU: "Raporlu",
  AYRILDI: "Ayrıldı",
} as const;

export const CALISMA_TIPI_LABELS = {
  NORMAL_MESAI: "Normal Mesai",
  FAZLA_MESAI: "Fazla Mesai",
  RESMI_TATIL: "Resmi Tatil",
  HAFTA_SONU: "Hafta Sonu",
  IZIN: "İzin",
  RAPOR: "Rapor",
} as const;

export const KONTROL_SONUC_LABELS = {
  UYGUN: "✅ Uygun",
  ARIZALI: "❌ Arızalı/Hatalı",
  DIKKAT_GEREKLI: "⚠ Dikkat Gerekli",
} as const;

export const KONTROL_PERIYOT_LABELS = {
  HAFTA_1: "1. Hafta",
  HAFTA_2: "2. Hafta",
  HAFTA_3: "3. Hafta",
  HAFTA_4: "4. Hafta",
  AYLIK_BAKIM: "Aylık Bakım",
} as const;

export const ROL_LABELS = {
  ADMIN: "Yönetici",
  CALL_CENTER: "Çağrı Merkezi",
  DEPARTMENT_MANAGER: "Müdürlük Yöneticisi",
  FIELD_WORKER: "Saha Personeli",
  DRIVER: "Şoför / Operatör",
  APPROVER: "Onaylayan",
} as const;

/** Prisma `Rol` ile uyumlu; client bundle Prisma çekmesin diye shared'da tutulur */
export type Rol = keyof typeof ROL_LABELS;

export const KANAL_LABELS = {
  TELEFON: "Telefon",
  WHATSAPP: "WhatsApp",
  WEB: "Web",
} as const;

// ── Mesai kuralları (Personel Günlük Takip formülleri) ──────────────────────
export const MESAI_KURALLARI = {
  /** Normal mesai başlangıcı (Excel: 08:00) */
  normalBaslangic: "08:00",
  /** Normal mesai bitişi / fazla mesai başlangıcı (Excel: 17:00) */
  normalBitis: "17:00",
  /** Öğle molası — normal saatten düşülür (Excel: 12:00-13:00) */
  oglenMolasiBaslangic: "12:00",
  oglenMolasiBitis: "13:00",
} as const;
