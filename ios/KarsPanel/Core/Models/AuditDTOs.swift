import Foundation

/// `/denetim` — panel ve API üzerinden yapılan işlemlerin kaydı.
struct DenetimListesiDTO: Decodable {
    let kayitlar: [DenetimKaydiDTO]
    let toplam: Int
    let page: Int
    let size: Int
    let toplamSayfa: Int
    /// Filtre seçenekleri; kayıtlardan türetilir
    let islemler: [String]
    let varliklar: [String]
}

struct DenetimKaydiDTO: Decodable, Identifiable, Hashable {
    let id: String
    let zaman: Date
    let userAd: String
    let rol: String
    let islem: String
    let varlik: String?
    let varlikId: String?
    /// Serbest biçimli JSON; okunur tek satıra çevrilir
    let detay: JSONValue?

    var islemEtiketi: String { DenetimIslemi.etiket(islem) }

    /// Web tablosu kimliğin son 6 karakterini gösterir; tam cuid'i taşımaz.
    var varlikMetni: String {
        guard let varlik else { return "—" }
        guard let varlikId, varlikId.count > 6 else { return varlik }
        return "\(varlik) \(varlikId.suffix(6))"
    }

    var detayMetni: String? { detay?.ozet }

    /// Rol kodu tanınıyorsa Türkçe etiketi, değilse ham kod (`-` gibi).
    var rolEtiketi: String { UserRole(rawValue: rol)?.label ?? rol }
}

/// Denetim kodlarının Türkçe karşılıkları. Web'de karşılığı olmayan kodlar ham
/// gösterilir; liste `ISLEM_LABELS` ile birebir aynıdır.
enum DenetimIslemi {
    private static let etiketler: [String: String] = [
        "GIRIS": "Giriş",
        "GIRIS_BASARISIZ": "Başarısız giriş",
        "SIKAYET_OLUSTUR": "Şikayet oluşturuldu",
        "SIKAYET_DURUM_GUNCELLE": "Şikayet durumu değişti",
        "SIKAYET_ATA": "Şikayet ataması",
        "GOREV_OLUSTUR": "Görev oluşturuldu",
        "GOREV_BASLAT": "Görev başlatıldı",
        "GOREV_KAPAT": "Görev kapatıldı",
        "KONTROL_FORMU_ONAYA_GONDER": "Kontrol formu onaya gönderildi",
        "KONTROL_FORMU_KARAR": "Kontrol formu kararı",
        "WHATSAPP_ONAYLA": "WhatsApp onaylandı",
        "WHATSAPP_REDDET": "WhatsApp reddedildi",
        "KULLANICI_OLUSTUR": "Kullanıcı oluşturuldu",
        "KULLANICI_GUNCELLE": "Kullanıcı güncellendi",
        "ARAC_OLUSTUR": "Araç oluşturuldu",
        "ARAC_GUNCELLE": "Araç güncellendi",
        "BAKIM_OLUSTUR": "Bakım kaydı",
        "YAKIT_OLUSTUR": "Yakıt kaydı",
        "MALZEME_OLUSTUR": "Malzeme oluşturuldu",
        "STOK_HAREKET_OLUSTUR": "Stok hareketi",
        "PERSONEL_OLUSTUR": "Personel oluşturuldu",
        "PERSONEL_GUNCELLE": "Personel güncellendi",
        "PERSONEL_GUNLUK_OLUSTUR": "Personel günlük kaydı",
        "ARAC_GUNLUK_OLUSTUR": "Araç günlük kaydı",
        "BETON_URETIM_OLUSTUR": "Beton üretimi",
        "BETON_STOK_GIRIS": "Beton stok girişi",
        "BETON_RECETE_GUNCELLE": "Beton reçetesi güncellendi",
        "BITUM_AYAR_KAYDET": "Bitüm ayarları",
        "BITUM_HAREKET_OLUSTUR": "Bitüm hareketi",
        "AGREGA_PARAMETRE_KAYDET": "Agrega parametreleri",
        "ASFALT_YOL_SIL": "Asfalt yolu silindi",
        "ENGEL_KAYDET": "Engel işaretlendi",
        "ENGEL_SIL": "Engel silindi",
    ]

    static func etiket(_ kod: String) -> String { etiketler[kod] ?? kod }
}

/// Şeması sabit olmayan `detay` alanı için asgari JSON modeli.
enum JSONValue: Decodable, Hashable {
    case metin(String)
    case sayi(Double)
    case mantiksal(Bool)
    case nesne([String: JSONValue])
    case dizi([JSONValue])
    case bos

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .bos
        } else if let v = try? c.decode(Bool.self) {
            self = .mantiksal(v)
        } else if let v = try? c.decode(Double.self) {
            self = .sayi(v)
        } else if let v = try? c.decode(String.self) {
            self = .metin(v)
        } else if let v = try? c.decode([String: JSONValue].self) {
            self = .nesne(v)
        } else if let v = try? c.decode([JSONValue].self) {
            self = .dizi(v)
        } else {
            self = .bos
        }
    }

    /// Tek satırda gösterilebilir özet: `{anahtar: değer, ...}`
    var ozet: String? {
        switch self {
        case let .metin(v): return v
        case let .sayi(v): return v == v.rounded() ? String(Int(v)) : String(v)
        case let .mantiksal(v): return v ? "evet" : "hayır"
        case let .nesne(sozluk):
            let parcalar = sozluk
                .sorted { $0.key < $1.key }
                .compactMap { anahtar, deger in
                    deger.ozet.map { "\(anahtar): \($0)" }
                }
            return parcalar.isEmpty ? nil : parcalar.joined(separator: ", ")
        case let .dizi(ogeler):
            let parcalar = ogeler.compactMap(\.ozet)
            return parcalar.isEmpty ? nil : parcalar.joined(separator: ", ")
        case .bos: return nil
        }
    }
}
