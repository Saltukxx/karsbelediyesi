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

/// `GET /api/v1/complaints/[id]` — liste alanlarının üstüne atanan personel,
/// işlem geçmişi ve fotoğraflar. İş emri raporu bu kayıttan üretilir.
struct ComplaintDetailDTO: Decodable, Identifiable {
    let id: String
    let sikayetNo: String?
    let kanal: String?
    let kayitTarihi: Date?
    let arayanKisi: String?
    let telefon: String?
    let neighborhood: NamedRefDTO?
    let acikAdres: String?
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
    let soforAdi: String?
    let soforTelefonu: String?
    let onaylayanAdi: String?
    let lat: Double?
    let lng: Double?
    let fotograflar: [ComplaintPhotoDTO]
    let personel: [ComplaintPersonnelDTO]
    let olaylar: [ComplaintEventDTO]

    /// Web ile aynı kural: yalnızca açık kayıtlarda atama ve durum formu görünür.
    var acikMi: Bool { durum == .ACIK || durum == .DEVAM_EDIYOR }
}

struct ComplaintPhotoDTO: Decodable, Identifiable, Hashable {
    let id: String
    let url: String
    /// VATANDAS (şikayet fotoğrafı) | COZUM (saha personelinin çözüm fotoğrafı)
    let tip: String?
}

struct ComplaintPersonnelDTO: Decodable, Identifiable, Hashable {
    let id: String
    let adSoyad: String
    let unvan: String?
    let telefon: String?
}

struct ComplaintEventDTO: Decodable, Identifiable, Hashable {
    let id: String
    let tip: String
    let kullanici: String?
    let eskiDurum: String?
    let yeniDurum: String?
    let createdAt: Date?

    /// Web `EVENT_LABELS` ile aynı metinler; bilinmeyen tip ham gösterilir.
    var label: String {
        switch tip {
        case "OLUSTURULDU": return "Kayıt oluşturuldu"
        case "DURUM_DEGISTI": return "Durum değiştirildi"
        case "GOREVLENDIRME": return "Görevlendirme yapıldı"
        case "MUDURLUK_ATAMA": return "Müdürlüğe yönlendirildi"
        case "NOT": return "Not eklendi"
        default: return tip
        }
    }

    /// "ACIK → DEVAM_EDIYOR" — yalnızca durum değişikliği olaylarında dolu.
    var degisim: String? {
        guard let eskiDurum, let yeniDurum else { return nil }
        let etiket = { (raw: String) in ComplaintStatus(rawValue: raw)?.label ?? raw }
        return "\(etiket(eskiDurum)) → \(etiket(yeniDurum))"
    }
}

/// `POST /api/v1/complaints/[id]/atama` — üç atama işlemi `islem` ayırıcısıyla
/// tek uçta toplanır (web'de üç ayrı form).
enum ComplaintAssignment: Encodable {
    case mudurluk(departmentId: String?)
    case personel(personnelIds: [String])
    case arac(vehicleId: String?, personnelIds: [String])

    private enum CodingKeys: String, CodingKey {
        case islem, departmentId, personnelIds, vehicleId
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .mudurluk(departmentId):
            try c.encode("MUDURLUK", forKey: .islem)
            try c.encode(departmentId, forKey: .departmentId)
        case let .personel(personnelIds):
            try c.encode("PERSONEL", forKey: .islem)
            try c.encode(personnelIds, forKey: .personnelIds)
        case let .arac(vehicleId, personnelIds):
            try c.encode("ARAC", forKey: .islem)
            try c.encode(vehicleId, forKey: .vehicleId)
            try c.encode(personnelIds, forKey: .personnelIds)
        }
    }
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
