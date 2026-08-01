import Foundation

/// `GET /api/v1/harita/katmanlar` — web'deki Leaflet katmanlarının tamamı.
struct MapLayersDTO: Decodable {
    let duzenleyebilir: Bool
    let personelAtayabilir: Bool
    let yollar: [AsphaltRoadDTO]
    let engeller: [RoadHazardDTO]
    let sikayetler: [ComplaintPinDTO]
    let araclar: [LiveVehicleDTO]
    let mudurlukler: [NamedRefDTO]
    let atanabilirPersonel: [MapPersonnelDTO]
}

struct AsphaltRoadDTO: Decodable, Identifiable, Hashable {
    let id: String
    let ad: String
    /// `[[lat, lng], ...]` — sunucu tüm rota geometrilerinde bu sırayı kullanır.
    let koordinatlar: [[Double]]
    let durum: String
    let dokumTarihi: Date?
    let notlar: String?
    let olusturan: String?
    let createdAt: Date?
    let departmentId: String?
    let mudurluk: String?
    let personel: [MapPersonnelDTO]

    var durumu: AsphaltStatus? { AsphaltStatus(rawValue: durum) }
    var personelAdlari: String? {
        personel.isEmpty ? nil : personel.map(\.adSoyad).joined(separator: ", ")
    }
}

struct MapPersonnelDTO: Decodable, Identifiable, Hashable {
    let id: String
    let adSoyad: String
    let unvan: String?

    init(id: String, adSoyad: String, unvan: String? = nil) {
        self.id = id
        self.adSoyad = adSoyad
        self.unvan = unvan
    }
}

struct RoadHazardDTO: Decodable, Identifiable, Hashable {
    let id: String
    let tip: String
    let lat: Double
    let lng: Double
    let aciklama: String?
    let durum: String
    let olusturan: String?
    let tarih: Date?
    let photoIds: [String]

    var tipi: HazardKind? { HazardKind(rawValue: tip) }
    var durumu: HazardStatus? { HazardStatus(rawValue: durum) }
}

struct ComplaintPinDTO: Decodable, Identifiable, Hashable {
    let id: String
    let sikayetNo: String
    let durum: String
    let durumKodu: String
    let lat: Double
    let lng: Double
    let aciklama: String?
}

struct LiveVehicleDTO: Decodable, Identifiable, Hashable {
    let id: String
    let plaka: String
    let tip: String?
    let lat: Double
    let lng: Double
    let zaman: Date?
}

// MARK: - Enum'lar

enum HazardKind: String, KBSelectableOption {
    case CUKUR
    case ENGEL
    case DIGER

    var displayName: String {
        switch self {
        case .CUKUR: return "Çukur"
        case .ENGEL: return "Engel"
        case .DIGER: return "Diğer"
        }
    }

    var symbolName: String {
        switch self {
        case .CUKUR: return "exclamationmark.triangle"
        case .ENGEL: return "cone"
        case .DIGER: return "mappin"
        }
    }
}

enum HazardStatus: String, KBSelectableOption {
    case ACIK
    case GIDERILDI

    var displayName: String {
        switch self {
        case .ACIK: return "Açık"
        case .GIDERILDI: return "Giderildi"
        }
    }

    var badgeTone: StatusBadgeTone {
        self == .ACIK ? .danger : .success
    }
}

// MARK: - İstekler

struct AsphaltRoadRequestDTO: Encodable {
    let ad: String
    let koordinatlar: [[Double]]
    let durum: String
    let dokumTarihi: String?
    let departmentId: String?
    let notlar: String?
}

/// Kısmi güncelleme: yalnız gönderilen alanlar değişir, `notlar`/`departmentId`
/// açıkça `null` gönderilirse temizlenir.
struct AsphaltRoadPatchDTO: Encodable {
    var ad: String?
    var koordinatlar: [[Double]]?
    var durum: String?
    var dokumTarihi: String?
    var departmentId: String??
    var notlar: String??

    enum CodingKeys: String, CodingKey {
        case ad, koordinatlar, durum, dokumTarihi, departmentId, notlar
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(ad, forKey: .ad)
        try c.encodeIfPresent(koordinatlar, forKey: .koordinatlar)
        try c.encodeIfPresent(durum, forKey: .durum)
        try c.encodeIfPresent(dokumTarihi, forKey: .dokumTarihi)
        // Çift opsiyonel: dış nil = alan gönderilmedi, iç nil = alanı temizle.
        if let departmentId { try c.encode(departmentId, forKey: .departmentId) }
        if let notlar { try c.encode(notlar, forKey: .notlar) }
    }
}

struct AsphaltRoadDeletedDTO: Decodable {
    let id: String
    let ad: String?
}

struct AsphaltPersonnelRequestDTO: Encodable {
    let personnelIds: [String]
}

struct AsphaltPersonnelResponseDTO: Decodable {
    let id: String
    let personel: [MapPersonnelDTO]
}

struct HazardCreatedDTO: Decodable {
    let id: String
    let tip: String
    let lat: Double
    let lng: Double
    let aciklama: String?
    let durum: String
    let photoIds: [String]
}

struct HazardStatusRequestDTO: Encodable {
    let durum: String
}

struct HazardStatusResponseDTO: Decodable {
    let id: String
    let durum: String
}

struct DeletedIdDTO: Decodable {
    let id: String
}
