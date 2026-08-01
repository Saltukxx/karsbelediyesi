import Foundation

/// Kış, çöp ve temizlik rotalarının ortak alanları. Üç modül de aynı
/// `[[lat, lng]]` geometrisini ve 1–3 arası önceliği kullanır.
protocol OperationRoute: Identifiable, Hashable {
    var id: String { get }
    var ad: String { get }
    var koordinatlar: [[Double]] { get }
    var oncelik: Int { get }
    var aktif: Bool { get }
    var notlar: String? { get }
}

extension OperationRoute {
    var oncelikEtiketi: String { RoutePriority(oncelik).displayName }
    var oncelikTonu: StatusBadgeTone { RoutePriority(oncelik).badgeTone }
}

/// Web formundaki 1 = en yüksek öncelik sırası korunur.
enum RoutePriority: Int, CaseIterable, Identifiable {
    case yuksek = 1
    case orta = 2
    case dusuk = 3

    init(_ raw: Int) {
        self = RoutePriority(rawValue: raw) ?? .orta
    }

    var id: Int { rawValue }

    var displayName: String {
        switch self {
        case .yuksek: return "1 · Yüksek"
        case .orta: return "2 · Orta"
        case .dusuk: return "3 · Düşük"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .yuksek: return .danger
        case .orta: return .warning
        case .dusuk: return .neutral
        }
    }
}

// MARK: - Kış

struct WinterOverviewDTO: Decodable {
    let duzenleyebilir: Bool
    let rotalar: [WinterRouteDTO]
    let malzemeler: [SaltMaterialDTO]
}

struct WinterRouteDTO: Decodable, OperationRoute {
    let id: String
    let ad: String
    let koordinatlar: [[Double]]
    let tip: String
    let oncelik: Int
    let aktif: Bool
    let notlar: String?
    let sonOperasyon: Date?
    let sonOperasyonlar: [WinterOperationDTO]

    var tipi: WinterRouteKind? { WinterRouteKind(rawValue: tip) }
}

struct WinterOperationDTO: Decodable, Identifiable, Hashable {
    let id: String
    let routeId: String
    let tip: String
    let vehicleId: String?
    let driverId: String?
    let baslangic: Date?
    let bitis: Date?
    let tuzKg: Double?
    let notlar: String?
    let plaka: String?
    let soforAdi: String?
}

struct SaltMaterialDTO: Decodable, Identifiable, Hashable {
    let id: String
    let kod: String?
    let ad: String
    let birim: String?
    let kategori: String?
    let stok: Double

    var etiket: String { "\(ad) (\(KBNumberFormat.miktar(stok, birim: birim)))" }
}

enum WinterRouteKind: String, KBSelectableOption {
    case KAR_KUREME
    case TUZLAMA
    case KARMA

    var displayName: String {
        switch self {
        case .KAR_KUREME: return "Kar Küreme"
        case .TUZLAMA: return "Tuzlama"
        case .KARMA: return "Karma"
        }
    }
}

enum WinterOperationKind: String, KBSelectableOption {
    case KURUME
    case TUZLAMA
    case KARMA

    var displayName: String {
        switch self {
        case .KURUME: return "Küreme"
        case .TUZLAMA: return "Tuzlama"
        case .KARMA: return "Karma"
        }
    }
}

struct WinterRouteRequestDTO: Encodable {
    let ad: String
    let koordinatlar: [[Double]]
    let tip: String
    let oncelik: Int
    let notlar: String?
}

struct WinterOperationRequestDTO: Encodable {
    let routeId: String
    let tip: String
    let vehicleId: String?
    let driverId: String?
    let baslangic: String?
    let bitis: String?
    let tuzKg: Double?
    let tuzMaterialId: String?
    let notlar: String?
}

// MARK: - Çöp

struct WasteOverviewDTO: Decodable {
    let duzenleyebilir: Bool
    let rotalar: [WasteRouteDTO]
}

struct WasteRouteDTO: Decodable, OperationRoute {
    let id: String
    let ad: String
    let koordinatlar: [[Double]]
    /// ISO gün numaraları: 1 = Pazartesi … 7 = Pazar
    let gunler: [Int]
    let oncelik: Int
    let aktif: Bool
    let notlar: String?
    let sonToplama: Date?
    let sonToplamalar: [WasteCollectionDTO]

    var gunEtiketi: String {
        gunler.isEmpty ? "—" : gunler.map(WeekDay.kisaAd(_:)).joined(separator: ", ")
    }
}

struct WasteCollectionDTO: Decodable, Identifiable, Hashable {
    let id: String
    let routeId: String
    let vehicleId: String?
    let driverId: String?
    let baslangic: Date?
    let bitis: Date?
    let notlar: String?
    let plaka: String?
    let soforAdi: String?
}

enum WeekDay: Int, CaseIterable, Identifiable {
    case pazartesi = 1
    case sali, carsamba, persembe, cuma, cumartesi, pazar

    var id: Int { rawValue }

    var ad: String {
        switch self {
        case .pazartesi: return "Pazartesi"
        case .sali: return "Salı"
        case .carsamba: return "Çarşamba"
        case .persembe: return "Perşembe"
        case .cuma: return "Cuma"
        case .cumartesi: return "Cumartesi"
        case .pazar: return "Pazar"
        }
    }

    var kisaAd: String { String(ad.prefix(3)) }

    static func kisaAd(_ raw: Int) -> String {
        WeekDay(rawValue: raw)?.kisaAd ?? String(raw)
    }

    /// `Calendar` pazarı 1 sayar; sunucu ISO sırasını (pazartesi = 1) bekler.
    static func isoGun(_ tarih: Date) -> Int {
        let hafta = Calendar(identifier: .gregorian).component(.weekday, from: tarih)
        return hafta == 1 ? 7 : hafta - 1
    }
}

/// Kış / çöp / temizlik rota formlarının ortak doğrulaması. UI'dan bağımsız
/// tutulur ki web formuyla parite testi yapılabilsin.
enum RouteFormValidation {
    static func hatalar(ad: String, noktalar: [KBCoordinate]) -> [String: String] {
        var sonuc: [String: String] = [:]
        if ad.trimmingCharacters(in: .whitespaces).isEmpty {
            sonuc["ad"] = "Rota adı gerekli"
        }
        if noktalar.count < 2 {
            sonuc["koordinatlar"] = "En az 2 nokta işaretleyin"
        }
        return sonuc
    }
}

struct WasteRouteRequestDTO: Encodable {
    let ad: String
    let koordinatlar: [[Double]]
    let gunler: [Int]
    let oncelik: Int
    let notlar: String?
}

struct WasteCollectionRequestDTO: Encodable {
    let routeId: String
    let vehicleId: String?
    let driverId: String?
    let baslangic: String?
    let bitis: String?
    let notlar: String?
}

// MARK: - Temizlik

struct CleaningOverviewDTO: Decodable {
    let duzenleyebilir: Bool
    let rotalar: [CleaningRouteDTO]
}

struct CleaningRouteDTO: Decodable, OperationRoute {
    let id: String
    let ad: String
    let koordinatlar: [[Double]]
    let oncelik: Int
    let aktif: Bool
    let notlar: String?
    /// Rotaya en son sevkiyat ataması yapılan zaman (web ile aynı hesap)
    let sonGorev: Date?
}

struct CleaningRouteRequestDTO: Encodable {
    let ad: String
    let koordinatlar: [[Double]]
    let oncelik: Int
    let notlar: String?
}

// MARK: - Ortak güncelleme

/// Üç modülün de `PATCH` gövdesi; gönderilmeyen alanlar sunucuda değişmez.
struct OperationRoutePatchDTO: Encodable {
    var ad: String?
    var koordinatlar: [[Double]]?
    var tip: String?
    var gunler: [Int]?
    var oncelik: Int?
    var aktif: Bool?
    var notlar: String?
}
