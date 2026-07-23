import Foundation

struct ActionRequestDTO: Encodable {
    let action: String
}

struct WhatsAppMessageDTO: Codable, Identifiable, Hashable {
    let id: String
    let telefon: String?
    let yon: String?
    let icerik: String?
    let onayDurumu: String?
    let guven: Double?
    let createdAt: Date?
}

struct ChecklistSubmissionDTO: Codable, Identifiable, Hashable {
    let id: String
    let sablonAdi: String?
    let durum: String?
    let operatorAdi: String?
    let createdAt: Date?
}

struct MaintenanceRecordDTO: Codable, Identifiable, Hashable {
    let id: String
    let plaka: String?
    let bakimTipi: String?
    let tarih: Date?
    let maliyet: Double?
    let aciklama: String?
}

struct FuelRecordDTO: Codable, Identifiable, Hashable {
    let id: String
    let plaka: String?
    let tarih: Date?
    let litre: Double?
    let tutar: Double?
    let istasyon: String?
}

struct FuelAnalysisDTO: Codable, Identifiable, Hashable {
    let id: String
    let plaka: String?
    let donem: String?
    let ortalamaTuketim: Double?
    let sapmaYuzde: Double?
}

struct MaterialStockDTO: Codable, Identifiable, Hashable {
    let id: String
    let malzemeAdi: String?
    let birim: String?
    let stokMiktari: Double?
    let minStok: Double?
    let depo: String?
}

struct ConcreteRecipeDTO: Codable, Identifiable, Hashable {
    let id: String
    let receteAdi: String?
    let sinif: String?
    let guncelStok: Double?
    let durum: String?
}

struct AgregaCostDTO: Codable, Identifiable, Hashable {
    let id: String
    let malzeme: String?
    let birimFiyat: Double?
    let miktar: Double?
    let toplam: Double?
}

struct BitumRecordDTO: Codable, Identifiable, Hashable {
    let id: String
    let tarih: Date?
    let miktar: Double?
    let proje: String?
    let aciklama: String?
}

struct PersonnelDTO: Codable, Identifiable, Hashable {
    let id: String
    let adSoyad: String?
    let unvan: String?
    let mudurluk: String?
    let durum: String?
}

struct WorkLogDTO: Codable, Identifiable, Hashable {
    let id: String
    let tarih: Date?
    let personelAdi: String?
    let plaka: String?
    let baslangic: String?
    let bitis: String?
    let durum: String?
}

struct DefinitionsDTO: Decodable {
    let departments: [NamedRefDTO]?
    let neighborhoods: [NamedRefDTO]?
    let complaintTypes: [NamedRefDTO]?
    let vehicleTypes: [NamedRefDTO]?
}

struct ReportSummaryDTO: Codable, Identifiable, Hashable {
    let id: String
    let baslik: String?
    let aciklama: String?
    let tip: String?
}

struct LookupsDTO: Decodable {
    let mahalleler: [NamedRefDTO]?
    let mudurlukler: [NamedRefDTO]?
    let sikayetTurleri: [NamedRefDTO]?
    let aracCinsleri: [String]?
}

struct LocationPingRequestDTO: Encodable {
    let lat: Double
    let lng: Double
    let hiz: Double?
}

struct LocationPingResponseDTO: Decodable {
    let ok: Bool
    let vehicleId: String?
}
