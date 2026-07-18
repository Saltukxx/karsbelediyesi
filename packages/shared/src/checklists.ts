/**
 * "İş Makineleri Bakim Kontrol.xlsx" dosyasından birebir çıkarılan
 * periyodik bakım kontrol listesi şablonları (5 makine, toplam 195 kalem).
 */

export interface ChecklistTemplateSeed {
  ekipmanAdi: string;
  aciklama: string;
  kategoriler: { kategori: string; kalemler: string[] }[];
}

export const KONTROL_LISTESI_SABLONLARI: ChecklistTemplateSeed[] = [
  {
    ekipmanAdi: "Greyder",
    aciklama: "Motor greyderı — Zemin tesviye ve yol yapım makinesi",
    kategoriler: [
      {
        kategori: "Motor & Yakıt Sistemi",
        kalemler: [
          "Motor yağı seviyesi kontrolü",
          "Soğutma suyu seviyesi kontrolü",
          "Yakıt filtresi kontrolü",
          "Hava filtresi temizliği/değişimi",
          "Motor kayış gerginliği kontrolü",
          "Egzoz sistemi kontrolü",
          "Turbo kontrol",
          "Yakıt sızıntısı kontrolü",
        ],
      },
      {
        kategori: "Hidrolik Sistem",
        kalemler: [
          "Hidrolik yağ seviyesi kontrolü",
          "Hidrolik hortum ve bağlantı kontrolü",
          "Hidrolik pompa ses ve basınç kontrolü",
          "Hidrolik silindir sızıntı kontrolü",
          "Hidrolik filtre kontrolü",
        ],
      },
      {
        kategori: "Şasi & Bıçak",
        kalemler: [
          "Bıçak (bıçak kenarı) aşınma kontrolü",
          "Bıçak bağlantı civatası kontrolü",
          "Çerçeve ve şasi çatlak kontrolü",
          "Ön eksen açı kontrolü",
          "Arka eksen kontrolü",
        ],
      },
      {
        kategori: "Fren & Şanzıman",
        kalemler: [
          "Fren pedal kontrolü",
          "Fren balatası kontrolü",
          "Şanzıman yağ seviyesi",
          "Şanzıman vites geçiş kontrolü",
          "Park freni kontrolü",
        ],
      },
      {
        kategori: "Elektrik & Güvenlik",
        kalemler: [
          "Akü şarj kontrolü",
          "Farlar ve sinyal lambaları",
          "Kabin içi gösterge kontrolü",
          "Korna kontrolü",
          "Geri vites ikaz sistemi",
          "Yangın söndürücü kontrolü",
          "Emniyet kemeri kontrolü",
        ],
      },
      {
        kategori: "Genel Bakım",
        kalemler: [
          "Lastik basıncı ve aşınma kontrolü",
          "Genel temizlik ve yıkama",
          "Yağlama noktaları gresörü",
          "Cıvata sıkılık genel kontrolü",
        ],
      },
    ],
  },
  {
    ekipmanAdi: "Ekskavatör",
    aciklama: "Paletli ekskavatör — Kazı ve yükleme makinesi",
    kategoriler: [
      {
        kategori: "Motor & Yakıt Sistemi",
        kalemler: [
          "Motor yağı seviyesi kontrolü",
          "Soğutma suyu seviyesi kontrolü",
          "Yakıt filtresi kontrolü",
          "Hava filtresi temizliği/değişimi",
          "Motor kayış gerginliği kontrolü",
          "Egzoz sistemi ve DPF kontrolü",
          "Yakıt deposu sızıntı kontrolü",
        ],
      },
      {
        kategori: "Hidrolik Sistem",
        kalemler: [
          "Hidrolik yağ seviyesi ve renk kontrolü",
          "Hidrolik hortum sızıntı kontrolü",
          "Ana kontrol valfi kontrolü",
          "Bom, dirsek, kepçe silindiri kontrolü",
          "Döner motor yağ kontrolü",
          "Hidrolik filtre değişim zamanı",
        ],
      },
      {
        kategori: "Ekipman & Kepçe",
        kalemler: [
          "Kepçe dişleri aşınma kontrolü",
          "Kepçe yan kesici kontrolü",
          "Kepçe pim ve burç kontrolü",
          "Bom pim ve burç kontrolü",
          "Dirsek pim ve burç kontrolü",
          "Kepçe bağlantı elemanları",
        ],
      },
      {
        kategori: "Palet & Tahrik",
        kalemler: [
          "Palet gerginlik kontrolü",
          "Palet plakası aşınma kontrolü",
          "Alt araba teker kontrolü",
          "Üst araba teker kontrolü",
          "Sürgü teker kontrolü",
          "Tahrik motoru yağ kontrolü",
          "Döner halka kontrolü",
        ],
      },
      {
        kategori: "Elektrik & Güvenlik",
        kalemler: [
          "Akü şarj ve bağlantı kontrolü",
          "Çalışma lambaları kontrolü",
          "Kabin içi gösterge ve uyarı ışıkları",
          "Kamera sistemi (varsa) kontrolü",
          "Korna ve ikaz sistemi",
          "Yangın söndürücü kontrolü",
          "Emniyet kemeri kontrolü",
        ],
      },
      {
        kategori: "Genel Bakım",
        kalemler: [
          "Genel temizlik ve yıkama",
          "Tüm gresör noktaları yağlama",
          "Radiator temizliği",
          "Cıvata sıkılık genel kontrolü",
        ],
      },
    ],
  },
  {
    ekipmanAdi: "JCB Loder",
    aciklama: "JCB loder — Beko loder, kazı ve yükleme makinesi",
    kategoriler: [
      {
        kategori: "Motor & Yakıt Sistemi",
        kalemler: [
          "Motor yağı seviyesi kontrolü",
          "Soğutma suyu seviyesi kontrolü",
          "Yakıt filtresi kontrolü",
          "Hava filtresi temizliği",
          "Kayış gerginliği ve aşınma",
          "Egzoz sistemi kontrolü",
          "Yakıt sızıntısı kontrolü",
        ],
      },
      {
        kategori: "Hidrolik Sistem",
        kalemler: [
          "Hidrolik yağ seviyesi kontrolü",
          "Hidrolik hortum ve konnektör kontrolü",
          "Hidrolik pompa ses kontrolü",
          "Bom ve kepçe silindiri kontrolü",
          "Hidrolik filtre durumu",
        ],
      },
      {
        kategori: "Kepçe & Ön Ekipman",
        kalemler: [
          "Kepçe dişleri ve kesici kenar aşınması",
          "Kepçe pim ve burç kontrolü",
          "Bom pim ve burç kontrolü",
          "Kepçe açı ve eğim kontrolü",
          "Kepçe bağlantı elemanları sıkılık",
        ],
      },
      {
        kategori: "Arka Ekipman (Kazıcı)",
        kalemler: [
          "Kazıcı kepçe dişleri kontrolü",
          "Kazıcı pim ve burç kontrolü",
          "Kazıcı stabilizatör kontrolü",
          "Döner platform kontrolü",
          "Kazıcı hidrolik kontrolü",
        ],
      },
      {
        kategori: "Fren, Şanzıman & Dingil",
        kalemler: [
          "Fren sistemi kontrolü",
          "Şanzıman yağ seviyesi",
          "Ön ve arka dingil yağ seviyesi",
          "4WD sistemi kontrolü (varsa)",
          "Direksiyon sistemi kontrolü",
        ],
      },
      {
        kategori: "Elektrik & Güvenlik",
        kalemler: [
          "Akü şarj kontrolü",
          "Farlar ve çalışma lambaları",
          "Kabin gösterge paneli",
          "Korna ve ikaz sistemi",
          "Yangın söndürücü kontrolü",
          "Emniyet kemeri kontrolü",
        ],
      },
      {
        kategori: "Genel Bakım",
        kalemler: [
          "Lastik basıncı ve aşınma",
          "Genel temizlik",
          "Tüm gresör noktaları yağlama",
          "Cıvata genel sıkılık kontrolü",
        ],
      },
    ],
  },
  {
    ekipmanAdi: "Silindir (Verdikter)",
    aciklama: "Toprak sıkıştırma silindiri (verdikter) — Zemin sıkıştırma",
    kategoriler: [
      {
        kategori: "Motor & Yakıt Sistemi",
        kalemler: [
          "Motor yağı seviyesi kontrolü",
          "Soğutma suyu seviyesi",
          "Yakıt filtresi kontrolü",
          "Hava filtresi temizliği",
          "Motor kayış kontrolü",
          "Egzoz sistemi kontrolü",
          "Yakıt sızıntısı kontrolü",
        ],
      },
      {
        kategori: "Hidrolik Sistem",
        kalemler: [
          "Hidrolik yağ seviyesi kontrolü",
          "Hidrolik hortum kontrolü",
          "Titreşim mekanizması yağ seviyesi",
          "Hidrolik pompa kontrolü",
          "Hidrolik filtre durumu",
        ],
      },
      {
        kategori: "Silindir Tamburları",
        kalemler: [
          "Ön tambur yüzey kontrolü",
          "Arka tambur(lar) yüzey kontrolü",
          "Tambur kenar aşınma kontrolü",
          "Tambur titreşim sistemi kontrolü",
          "Tambur yatak ve pim kontrolü",
          "Kazıyıcı bıçak aşınma kontrolü",
          "Su spreyi sistemi (varsa) kontrolü",
        ],
      },
      {
        kategori: "Şasi & Eklemler",
        kalemler: [
          "Çerçeve çatlak kontrolü",
          "Eklem pim ve burç kontrolü",
          "Direksiyon silindiri kontrolü",
          "Direksiyon hidrolik kontrolü",
          "Şasi bağlantı cıvataları",
        ],
      },
      {
        kategori: "Fren & Tahrik",
        kalemler: [
          "Fren sistemi kontrolü",
          "Şanzıman yağ seviyesi",
          "Tahrik motoru kontrolü",
          "Park freni kontrolü",
          "Dingil yağ seviyeleri",
        ],
      },
      {
        kategori: "Elektrik & Güvenlik",
        kalemler: [
          "Akü şarj kontrolü",
          "Çalışma lambaları",
          "Kabin gösterge paneli",
          "Titreşim frekans ayarı kontrolü",
          "Korna ve ikaz sistemi",
          "Yangın söndürücü",
          "Emniyet kemeri",
        ],
      },
      {
        kategori: "Genel Bakım",
        kalemler: [
          "Genel temizlik ve yıkama",
          "Tüm gresör noktaları yağlama",
          "Radyatör temizliği",
          "Genel cıvata sıkılık kontrolü",
        ],
      },
    ],
  },
  {
    ekipmanAdi: "Mercedes Hafriyat Kamyonu",
    aciklama: "Hafriyat/damper kamyonu — Mercedes marka nakliye aracı",
    kategoriler: [
      {
        kategori: "Motor & Yakıt Sistemi",
        kalemler: [
          "Motor yağı seviyesi ve rengi",
          "Soğutma suyu seviyesi",
          "Yakıt filtresi kontrolü",
          "Hava filtresi kontrolü",
          "Turbo ve intercooler kontrolü",
          "Egzoz ve AdBlue sistemi",
          "Yakıt deposu ve bağlantıları",
          "DPF filtre durumu",
        ],
      },
      {
        kategori: "Şanzıman & Aktarma",
        kalemler: [
          "Şanzıman yağ seviyesi",
          "Şanzıman vites geçiş kontrolü",
          "Transfer kutusu yağ seviyesi",
          "Diferansiyel yağ seviyeleri",
          "Kardan mili ve mafsallar",
          "Kavrama sistemi kontrolü",
        ],
      },
      {
        kategori: "Fren Sistemi",
        kalemler: [
          "Servis freni balata kontrolü",
          "Park freni kontrolü",
          "Hava tankı su boşaltma",
          "Fren hava basıncı kontrolü",
          "ABS sistemi uyarı ışığı",
          "Fren hortum ve bağlantıları",
          "Motor freni (jakbrake) kontrolü",
        ],
      },
      {
        kategori: "Damper & Kasa",
        kalemler: [
          "Hidrolik yağ seviyesi kontrolü",
          "Damper silindiri sızıntı kontrolü",
          "Damper kasa yapısal kontrolü",
          "Damper destek ayağı kontrolü",
          "Bağlantı cıvataları sıkılık",
          "Arka kapak kilit mekanizması",
        ],
      },
      {
        kategori: "Lastik & Süspansiyon",
        kalemler: [
          "Lastik basıncı (tüm tekerlekler)",
          "Lastik aşınma ve derinlik",
          "Süspansiyon yay kontrolü",
          "Amortisör sızıntı kontrolü",
          "Tekerlek somun sıkılık",
          "Ön rot ve rotil kontrolü",
        ],
      },
      {
        kategori: "Elektrik & Güvenlik",
        kalemler: [
          "Akü şarj ve bağlantı",
          "Farlar, sinyal ve stop lambaları",
          "Çalışma ve arka lambalar",
          "Kabin gösterge paneli",
          "Takoğraf/dijital kayıt cihazı",
          "Korna ve geri ikaz",
          "Yangın söndürücü",
          "Emniyet kemeri",
          "Reflektörler ve döner tepe lambası",
        ],
      },
      {
        kategori: "Genel Bakım",
        kalemler: [
          "Genel temizlik ve yıkama",
          "Şasi yağlama noktaları",
          "Radyatör temizliği",
          "Kabin ve kapı menteşe yağlama",
          "Genel cıvata kontrolü",
        ],
      },
    ],
  },
];

/** Şablon başına toplam kalem sayısı (Excel GENEL BİLGİ sayfasıyla doğrulama için) */
export function toplamKalemSayisi(sablon: ChecklistTemplateSeed): number {
  return sablon.kategoriler.reduce((t, k) => t + k.kalemler.length, 0);
}
