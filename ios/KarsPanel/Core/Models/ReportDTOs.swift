import Foundation

/// `/raporlar` — SLA özeti, müdürlük KPI'ı ve genel toplamlar.
struct RaporOzetiDTO: Decodable {
    let sla: SlaOzetiDTO
    let toplamSikayet: Int
    let toplamArac: Int
    let toplamGorev: Int
    let yakitBakimToplam: Double
}

struct SlaOzetiDTO: Decodable {
    let bucketLt24h: Int
    let bucket1to3d: Int
    let bucketGt3d: Int
    let overdueUrgent: [SlaGecikenDTO]
    let byDepartment: [SlaMudurlukDTO]
}

struct SlaGecikenDTO: Decodable, Identifiable, Hashable {
    let id: String
    let sikayetNo: String
    let arayanKisi: String
    let oncelik: String
    let kayitTarihi: Date
    let departmentName: String?

    var oncelikEtiketi: String {
        switch oncelik {
        case "COK_ACIL": return "Çok Acil"
        case "ACIL": return "Acil"
        case "NORMAL": return "Normal"
        case "DUSUK": return "Düşük"
        default: return oncelik
        }
    }

    var oncelikTonu: StatusBadgeTone {
        oncelik == "COK_ACIL" ? .danger : .warning
    }
}

struct SlaMudurlukDTO: Decodable, Identifiable, Hashable {
    let departmentId: String?
    let departmentName: String
    let acik: Int
    let kapatilan30g: Int
    let ortKapanisGun: Double?

    var id: String { departmentId ?? "atanmamis" }
}

struct MahalleAnaliziDTO: Decodable, Identifiable, Hashable {
    let ad: String
    let toplam: Int
    let acik: Int
    let kapanan: Int
    let ortCozumGun: Double?
    let enSikTip: String

    var id: String { ad }
}

struct IsMaliyetiDTO: Decodable {
    let satirlar: [MaliyetSatiriDTO]
    let mudurlukToplamlari: [MudurlukToplamiDTO]
}

struct MaliyetSatiriDTO: Decodable, Identifiable, Hashable {
    let id: String
    let gorevNo: String
    let plaka: String
    let gorevTanimi: String?
    let mudurluk: String
    let maliyet: GorevMaliyetDTO
}

struct GorevMaliyetDTO: Decodable, Hashable {
    let yakit: Double
    let yakitTahmini: Bool
    let malzeme: Double
    let iscilik: Double
    let diger: Double
    let toplam: Double
}

struct MudurlukToplamiDTO: Decodable, Identifiable, Hashable {
    let mudurluk: String
    let toplam: Double

    var id: String { mudurluk }
}

/// Excel dışa aktarma kataloğu kalemi.
struct ExportKalemiDTO: Decodable, Identifiable, Hashable {
    let entity: String
    let baslik: String
    let href: String
    /// Kullanıcının rolü bu dosyayı indirebiliyor mu
    let izinli: Bool
    /// `from`/`to` parametrelerini dikkate alıp almadığı
    let tarihFiltreli: Bool

    var id: String { entity }
}
