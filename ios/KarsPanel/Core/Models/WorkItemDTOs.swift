import Foundation

/// `GET /api/v1/islerim` — saha personelinin yalnızca kendisine atanmış işleri.
/// Yetki rolle değil atamayla belirlenir; liste zaten kapsanmış gelir.
struct WorkItemsDTO: Decodable {
    let personel: WorkItemPersonnelDTO?
    let aracGorevleri: [WorkItemTaskDTO]
    let sikayetler: [WorkItemComplaintDTO]
    let rotalar: [WorkItemRoadDTO]
}

struct WorkItemPersonnelDTO: Decodable, Hashable {
    let id: String
    let adSoyad: String
    let mudurluk: String?
}

struct WorkItemTaskDTO: Decodable, Identifiable, Hashable {
    let id: String
    let gorevNo: String
    let durum: String
    let plaka: String
    let gorevYeri: String?
    let gorevTanimi: String?
    let cikisTarihi: Date?
    let girisTarihi: Date?
    /// Dispatch rotasına bağlı: takip raporu üretilebilir
    let takipVar: Bool
}

struct WorkItemComplaintDTO: Decodable, Identifiable, Hashable {
    let id: String
    let sikayetNo: String
    let kanal: String
    let durum: ComplaintStatus
    let oncelik: ComplaintPriority
    let kayitTarihi: Date?
    let arayanKisi: String?
    let telefon: String?
    let acikAdres: String?
    let aciklama: String?
    let tur: String?
    let mahalle: String?
    let mudurluk: String?
}

struct WorkItemRoadDTO: Decodable, Identifiable, Hashable {
    let id: String
    let ad: String
    let durum: String
    let mudurluk: String?
    let dokumTarihi: Date?
    let notlar: String?
}

/// `GET /api/v1/islerim/sikayet/[id]` — atanan şikayetin kartı + konuşma geçmişi.
struct WorkItemComplaintDetailDTO: Decodable {
    let id: String
    let sikayetNo: String
    let kanal: String
    let durum: ComplaintStatus
    let oncelik: ComplaintPriority
    let kayitTarihi: Date?
    let arayanKisi: String?
    let telefon: String?
    let acikAdres: String?
    let aciklama: String?
    let tur: String?
    let mahalle: String?
    let mudurluk: String?
    let cozumNotu: String?
    let kapanisTarihi: Date?
    let fotograflar: [ComplaintPhotoDTO]
    let mesajlar: [WorkItemMessageDTO]

    var acikMi: Bool { durum == .ACIK || durum == .DEVAM_EDIYOR }
}

struct WorkItemMessageDTO: Decodable, Identifiable, Hashable {
    let id: String
    /// GELEN | GIDEN
    let yon: String
    let icerik: String?
    let medyaUrl: String?
    let medyaTipi: String?
    let gonderimDurumu: String?
    let gonderen: String?
    let createdAt: Date?

    var gelenMi: Bool { yon == "GELEN" }
}

struct WorkItemStatusRequestDTO: Encodable {
    let durum: String
    let cozumNotu: String?
}

struct WorkItemRoadStatusRequestDTO: Encodable {
    let durum: String
}

struct WhatsAppReplyRequestDTO: Encodable {
    let text: String
}

/// Saha personelinin asfalt rotasında seçebildiği durumlar (`AsfaltDurum`).
enum AsphaltStatus: String, KBSelectableOption {
    case PLANLANDI
    case DEVAM_EDIYOR
    case TAMAMLANDI

    var displayName: String {
        switch self {
        case .PLANLANDI: return "Planlandı"
        case .DEVAM_EDIYOR: return "Devam Ediyor"
        case .TAMAMLANDI: return "Tamamlandı"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .PLANLANDI: return .info
        case .DEVAM_EDIYOR: return .warning
        case .TAMAMLANDI: return .success
        }
    }
}
