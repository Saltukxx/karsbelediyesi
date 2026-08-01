import Foundation

/// `KontrolFormDurum` — periyodik kontrol formunun onay akışı.
enum ChecklistStatus: String, KBSelectableOption {
    case TASLAK
    case ONAY_BEKLIYOR
    case ONAYLANDI
    case REDDEDILDI

    var displayName: String {
        switch self {
        case .TASLAK: return "Taslak"
        case .ONAY_BEKLIYOR: return "Onay Bekliyor"
        case .ONAYLANDI: return "Onaylandı"
        case .REDDEDILDI: return "Reddedildi"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .TASLAK: return .neutral
        case .ONAY_BEKLIYOR: return .warning
        case .ONAYLANDI: return .success
        case .REDDEDILDI: return .danger
        }
    }
}

/// `KontrolPeriyot` — Excel formunun 1-4. hafta + aylık bakım sütunları.
/// Sunucu sütun sırasını yanıtta gönderdiği için `Codable`.
enum ChecklistPeriod: String, Codable, KBSelectableOption {
    case HAFTA_1
    case HAFTA_2
    case HAFTA_3
    case HAFTA_4
    case AYLIK_BAKIM

    var displayName: String {
        switch self {
        case .HAFTA_1: return "1. Hafta"
        case .HAFTA_2: return "2. Hafta"
        case .HAFTA_3: return "3. Hafta"
        case .HAFTA_4: return "4. Hafta"
        case .AYLIK_BAKIM: return "Aylık Bakım"
        }
    }

    /// Matris başlığı için kısaltma
    var shortName: String {
        switch self {
        case .HAFTA_1: return "H1"
        case .HAFTA_2: return "H2"
        case .HAFTA_3: return "H3"
        case .HAFTA_4: return "H4"
        case .AYLIK_BAKIM: return "Aylık"
        }
    }
}

/// `KontrolSonuc` — kalem değerlendirmesi. ARIZALI otomatik bakım kaydı açar.
enum ChecklistResult: String, KBSelectableOption {
    case UYGUN
    case ARIZALI
    case DIKKAT_GEREKLI

    var displayName: String {
        switch self {
        case .UYGUN: return "Uygun"
        case .ARIZALI: return "Arızalı / Hatalı"
        case .DIKKAT_GEREKLI: return "Dikkat Gerekli"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .UYGUN: return .success
        case .ARIZALI: return .danger
        case .DIKKAT_GEREKLI: return .warning
        }
    }

    var symbolName: String {
        switch self {
        case .UYGUN: return "checkmark.circle.fill"
        case .ARIZALI: return "xmark.octagon.fill"
        case .DIKKAT_GEREKLI: return "exclamationmark.triangle.fill"
        }
    }
}

/// `GET /api/v1/checklists` — doldurulmuş formlar + seçilebilir şablon ve araçlar.
struct ChecklistOverviewDTO: Decodable {
    let formlar: [ChecklistSummaryDTO]
    let sablonlar: [ChecklistTemplateDTO]
    let araclar: [VehicleRefDTO]
    let periyotlar: [ChecklistPeriod]
}

struct ChecklistSummaryDTO: Decodable, Identifiable, Hashable {
    let id: String
    let sablonId: String
    let sablonAdi: String
    let plaka: String
    let ay: Int
    let yilDonem: Int
    let durum: String
    let operatorAdi: String?
    let santiyeLokasyon: String?
    let doldurulanKalem: Int
    let onayTarihi: Date?
    let createdAt: Date?

    var durumu: ChecklistStatus? { ChecklistStatus(rawValue: durum) }
    var donem: String { "\(ay)/\(yilDonem)" }
}

struct ChecklistTemplateDTO: Decodable, Identifiable, Hashable {
    let id: String
    let ekipmanAdi: String
    let aciklama: String?
    let kalemSayisi: Int
}

/// `GET /api/v1/checklists/[id]` — kalem × periyot matrisi ve mevcut sonuçlar.
struct ChecklistDetailDTO: Decodable {
    let id: String
    let sablonAdi: String
    let plaka: String
    let aracAdi: String?
    let ay: Int
    let yilDonem: Int
    let durum: String
    /// Web ile aynı kural: taslak ve onay bekleyen formlar düzenlenebilir.
    let duzenlenebilir: Bool
    let sorumluOperatorTeknisyen: String?
    let santiyeLokasyon: String?
    let operatorAdi: String?
    let teknisyenAdi: String?
    let sefAmirAdi: String?
    let onaylayanAdi: String?
    let onayTarihi: Date?
    let createdAt: Date?
    let periyotlar: [ChecklistPeriod]
    let kategoriler: [ChecklistCategoryDTO]
    let arizaliSayisi: Int
    let dikkatSayisi: Int

    var durumu: ChecklistStatus? { ChecklistStatus(rawValue: durum) }
    var donem: String { "\(ay)/\(yilDonem)" }
    var kalemSayisi: Int { kategoriler.reduce(0) { $0 + $1.kalemler.count } }
}

struct ChecklistCategoryDTO: Decodable, Identifiable, Hashable {
    let kategori: String
    let kalemler: [ChecklistItemDTO]

    var id: String { kategori }
}

struct ChecklistItemDTO: Decodable, Identifiable, Hashable {
    let id: String
    let siraNo: Int
    let kontrolKalemi: String
    /// Periyot adı → sonuç; doldurulmamış periyotlar null gelir.
    let sonuclar: [String: ChecklistItemResultDTO?]

    func sonuc(_ periyot: ChecklistPeriod) -> ChecklistItemResultDTO? {
        sonuclar[periyot.rawValue] ?? nil
    }

    /// Periyot notları tek satırda birleştirilir (web yazdırma sayfasıyla aynı).
    /// Sözlük sırası belirsiz olduğu için periyot sırası sabitlenir.
    var notMetni: String? {
        let notlar = ChecklistPeriod.allCases
            .compactMap { sonuc($0)?.aciklamaNot }
            .filter { !$0.isEmpty }
        return notlar.isEmpty ? nil : notlar.joined(separator: "; ")
    }
}

struct ChecklistItemResultDTO: Decodable, Hashable {
    let sonuc: String
    let aciklamaNot: String?

    var degerlendirme: ChecklistResult? { ChecklistResult(rawValue: sonuc) }
}

// MARK: - İstekler

struct ChecklistCreateRequestDTO: Encodable {
    var templateId: String
    var vehicleId: String
    var ay: Int
    var yilDonem: Int
    var sorumluOperatorTeknisyen: String?
    var santiyeLokasyon: String?
}

struct ChecklistCreatedDTO: Decodable {
    let id: String
    let templateId: String
    let vehicleId: String
    let ay: Int
    let yilDonem: Int
    let durum: String
}

/// Tek kalem kaydı. Çevrimdışı kuyrukta saklandığı için `Codable`.
struct ChecklistItemRequestDTO: Codable, Hashable {
    var templateItemId: String
    var periyot: String
    var sonuc: String
    var aciklamaNot: String?
}

struct ChecklistItemSavedDTO: Decodable {
    let id: String
    let templateItemId: String
    let periyot: String
    let sonuc: String
    let aciklamaNot: String?
    /// ARIZALI sonucunda açılan otomatik bakım kaydı
    let bakimKaydiId: String?
}

struct ChecklistSubmitRequestDTO: Encodable {
    var teknisyenAdi: String?
    var sefAmirAdi: String?
}

struct ChecklistDecisionRequestDTO: Encodable {
    /// ONAYLANDI | REDDEDILDI
    var karar: String
    var sefAmirAdi: String?
}

struct ChecklistStateDTO: Decodable {
    let id: String
    let durum: String
}
