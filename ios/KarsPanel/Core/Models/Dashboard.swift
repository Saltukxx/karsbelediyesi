import Foundation

struct DashboardDeltaDTO: Decodable, Equatable {
    let current: Double
    let previous: Double
    let changePct: Double?
}

struct DashboardKpiDTO: Decodable {
    let yeniSikayet: DashboardDeltaDTO
    let kapatilanSikayet: DashboardDeltaDTO
    let ortKapanisGun: DashboardDeltaDTO
    let tamamlananGorev: DashboardDeltaDTO
    let operasyonMaliyeti: DashboardDeltaDTO
}

struct DashboardMuayeneKirilimDTO: Decodable {
    let muayene: Int
    let sigorta: Int
    let bakim: Int
}

struct DashboardAnlikDTO: Decodable {
    let acikSikayet: Int
    let devamEdenSikayet: Int
    let cokAcil: Int
    let acil: Int
    let acilSikayet: Int
    let onayBekleyenWhatsApp: Int
    let devamGorev: Int
    let yaklasanMuayene: Int
    let yaklasanMuayeneKirilim: DashboardMuayeneKirilimDTO?
    let konumEksikAcik: Int
    let kritikStokToplam: Int
    let kritikMalzeme: Int?
    let kritikBeton: Int?
    let kritikBitum: Int?
    let aracOperasyon: [String: Int]?
    let aracEnvanter: [String: Int]?
}

struct DashboardTrendPointDTO: Decodable, Identifiable {
    let gun: String
    let acilan: Int
    let kapanan: Int

    var id: String { gun }
}

struct DashboardMaliyetPointDTO: Decodable, Identifiable {
    let ay: String
    let bakim: Double
    let yakit: Double

    var id: String { ay }
}

struct DashboardMudurlukDTO: Decodable, Identifiable {
    let departmentId: String?
    let name: String
    let toplam: Int
    let acik: Int?
    let devam: Int?
    let kapatildi: Int?
    let cokAcil: Int?
    let acil: Int?

    var id: String { departmentId ?? name }

    enum CodingKeys: String, CodingKey {
        case departmentId = "id"
        case name, toplam, acik, devam, kapatildi, cokAcil, acil
    }
}

struct DashboardTurDTO: Decodable, Identifiable {
    let name: String
    let toplam: Int
    let acik: Int?
    let kapatildi: Int?

    var id: String { name }
}

struct DashboardKanalDTO: Decodable, Identifiable {
    let kanal: String
    let toplam: Int

    var id: String { kanal }
}

struct DashboardMahalleDTO: Decodable, Identifiable {
    let name: String
    let toplam: Int

    var id: String { name }
}

struct DashboardSaatlikDTO: Decodable, Identifiable {
    let haftaGunu: Int
    let saat: Int
    let adet: Int

    var id: String { "\(haftaGunu)-\(saat)" }
}

struct DashboardCoordinateDTO: Decodable, Hashable, Identifiable {
    let lat: Double
    let lng: Double

    var id: String { "\(lat),\(lng)" }

    init(lat: Double, lng: Double) {
        self.lat = lat
        self.lng = lng
    }

    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        lat = try container.decode(Double.self)
        lng = try container.decode(Double.self)
    }
}

struct DashboardSlaDTO: Decodable {
    let bucketLt24h: Int
    let bucket1to3d: Int
    let bucketGt3d: Int
}

struct DashboardDTO: Decodable {
    let kpi: DashboardKpiDTO?
    let anlik: DashboardAnlikDTO?
    let trend: [DashboardTrendPointDTO]?
    let maliyetTrend: [DashboardMaliyetPointDTO]?
    let mudurlukDagilim: [DashboardMudurlukDTO]?
    let turDagilim: [DashboardTurDTO]?
    let kanalDagilim: [DashboardKanalDTO]?
    let mahalleDagilim: [DashboardMahalleDTO]?
    let saatlikYogunluk: [DashboardSaatlikDTO]?
    let sikayetKonumlari: [DashboardCoordinateDTO]?
    let sla: DashboardSlaDTO?
    let preset: String?
    let bas: Date?
    let bit: Date?

    let acikSikayetler: Int?
    let devamEdenSikayetler: Int?
    let kapaliSikayetler: Int?
    let bekleyenWhatsApp: Int?
    let aktifGorevler: Int?
    let planlananGorevler: Int?
    let aktifAraclar: Int?
    let bakimGereken: Int?
    let dusukStokMalzeme: Int?
    let sonSikayetler: [ComplaintSummaryDTO]?
    let sonGorevler: [VehicleTaskSummaryDTO]?

    var hasAnalytics: Bool { kpi != nil && anlik != nil }

    /// Canlı ince payload'da `kpi`/`anlik` yok; Figma layout yine dolsun diye türetir.
    var displayAnlik: DashboardAnlikDTO {
        if let anlik { return anlik }
        return DashboardAnlikDTO(
            acikSikayet: acikSikayetler ?? 0,
            devamEdenSikayet: devamEdenSikayetler ?? 0,
            cokAcil: 0,
            acil: 0,
            acilSikayet: acikSikayetler ?? 0,
            onayBekleyenWhatsApp: bekleyenWhatsApp ?? 0,
            devamGorev: aktifGorevler ?? 0,
            yaklasanMuayene: bakimGereken ?? 0,
            yaklasanMuayeneKirilim: nil,
            konumEksikAcik: 0,
            kritikStokToplam: dusukStokMalzeme ?? 0,
            kritikMalzeme: dusukStokMalzeme,
            kritikBeton: nil,
            kritikBitum: nil,
            aracOperasyon: aktifAraclar.map { ["AKTIF": $0] },
            aracEnvanter: aktifAraclar.map { ["AKTIF": $0] }
        )
    }

    var displayKpi: DashboardKpiDTO {
        if let kpi { return kpi }
        func delta(_ value: Int?) -> DashboardDeltaDTO {
            DashboardDeltaDTO(current: Double(value ?? 0), previous: 0, changePct: nil)
        }
        return DashboardKpiDTO(
            yeniSikayet: delta(acikSikayetler),
            kapatilanSikayet: delta(kapaliSikayetler),
            ortKapanisGun: delta(nil),
            tamamlananGorev: delta(aktifGorevler),
            operasyonMaliyeti: delta(nil)
        )
    }
}

struct ComplaintSummaryDTO: Decodable, Identifiable {
    let id: String
    let sikayetNo: String?
    let arayanKisi: String?
    let durum: String?
    let oncelik: String?
}

struct VehicleTaskSummaryDTO: Decodable, Identifiable {
    let id: String
    let gorevNo: String?
    let durum: String?
    let plaka: String?
}

enum DashboardRangePreset: String, CaseIterable, Identifiable {
    case d7 = "7g"
    case d30 = "30g"
    case d90 = "90g"
    case custom = "ozel"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .d7: return "Son 7 gün"
        case .d30: return "Son 30 gün"
        case .d90: return "Son 90 gün"
        case .custom: return "Özel"
        }
    }
}
