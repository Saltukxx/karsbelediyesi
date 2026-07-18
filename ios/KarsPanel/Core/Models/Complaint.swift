import Foundation

enum ComplaintStatus: String, Codable, CaseIterable {
    case ACIK
    case DEVAM_EDIYOR
    case KAPATILDI
    case IPTAL

    var label: String {
        switch self {
        case .ACIK: return "Açık"
        case .DEVAM_EDIYOR: return "Devam Ediyor"
        case .KAPATILDI: return "Kapalı"
        case .IPTAL: return "İptal"
        }
    }
}

enum ComplaintPriority: String, Codable, CaseIterable {
    case NORMAL
    case ACIL
    case COK_ACIL

    var label: String {
        switch self {
        case .NORMAL: return "Normal"
        case .ACIL: return "Acil"
        case .COK_ACIL: return "Çok Acil"
        }
    }
}

struct NamedRefDTO: Codable, Identifiable, Hashable {
    let id: String
    let name: String?
}

struct ComplaintDTO: Codable, Identifiable, Hashable {
    let id: String
    let sikayetNo: String?
    let yil: Int?
    let sira: Int?
    let kanal: String?
    let kayitTarihi: Date?
    let arayanKisi: String?
    let telefon: String?
    let neighborhoodId: String?
    let neighborhood: NamedRefDTO?
    let acikAdres: String?
    let complaintTypeId: String?
    let complaintType: NamedRefDTO?
    let aciklama: String?
    let departmentId: String?
    let department: NamedRefDTO?
    let oncelik: ComplaintPriority?
    let durum: ComplaintStatus?
    let kapanisTarihi: Date?
    let cozumNotu: String?
    let vehicleId: String?
    let vehicle: VehicleSummaryDTO?
    let lat: Double?
    let lng: Double?
}

struct VehicleSummaryDTO: Codable, Hashable {
    let id: String
    let plaka: String?
}

struct CreateComplaintRequestDTO: Encodable {
    let arayanKisi: String
    let telefon: String?
    let neighborhoodId: String?
    let acikAdres: String?
    let complaintTypeId: String?
    let departmentId: String?
    let aciklama: String?
    let oncelik: ComplaintPriority?
    let kanal: String?
}

struct UpdateComplaintRequestDTO: Encodable {
    let durum: ComplaintStatus?
    let cozumNotu: String?
    let lat: Double?
    let lng: Double?
}
