import Foundation

// MARK: - Araç

/// `/api/v1/vehicles` liste satırı. (Şikayet/görev içine gömülü minimal
/// `VehicleSummaryDTO` ile karıştırılmamalı.)
struct VehicleListItemDTO: Codable, Identifiable, Hashable {
    let id: String
    let plaka: String
    let ad: String?
    let marka: String?
    let model: String?
    let modelYili: Int?
    let cins: String?
    let vehicleTypeId: String?
    let mudurluk: String?
    let departmentId: String?
    let envanterDurumu: String
    let operasyonDurumu: String
    let sayacDeger: Double?
    let sayacBirim: String?
    let sayacTipi: String?
    let atananSoforId: String?
    let atananSoforAdi: String?
    let muayeneTarihi: Date?
    let sigortaBitis: Date?
    let sonrakiBakimTarihi: Date?

    var baslik: String { plaka }
    var altBaslik: String {
        [marka, model, cins].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

struct VehicleDetailDTO: Codable, Identifiable, Hashable {
    let id: String
    let plaka: String
    let ad: String?
    let marka: String?
    let model: String?
    let modelYili: Int?
    let cins: String?
    let vehicleTypeId: String?
    let mudurluk: String?
    let departmentId: String?
    let envanterDurumu: String
    let operasyonDurumu: String
    let sayacDeger: Double?
    let sayacBirim: String?
    let sayacTipi: String?
    let atananSoforId: String?
    let atananSoforAdi: String?
    let muayeneTarihi: Date?
    let sigortaBitis: Date?
    let sonrakiBakimTarihi: Date?
    let yakitTipi: String?
    let kapasite: String?
    let normTuketim: Double?
    let bakimKmSaati: String?
    let sonBakimTarihi: Date?
    let notlar: String?
    let sonKonumLat: Double?
    let sonKonumLng: Double?
    let sonKonumZamani: Date?
}

/// `/api/v1/vehicles/[id]` — araç kartının tüm sekmeleri
struct VehicleCardDTO: Decodable {
    let arac: VehicleDetailDTO
    let bakimlar: [MaintenanceSummaryDTO]
    let yakitlar: [FuelSummaryDTO]
    let gorevler: [VehicleTaskBriefDTO]
    let gunlukCalismalar: [VehicleWorkLogBriefDTO]
}

struct MaintenanceSummaryDTO: Codable, Identifiable, Hashable {
    let id: String
    let bakimTarihi: Date?
    let bakimTuru: String
    let durum: String
    let maliyet: Double?
    let yapilanIslemler: String?
}

struct FuelSummaryDTO: Codable, Identifiable, Hashable {
    let id: String
    let tarih: Date?
    let yakitTuru: String
    let litre: Double?
    let birimFiyat: Double?
    let tutar: Double?
    let sayac: Double?
}

struct VehicleTaskBriefDTO: Codable, Identifiable, Hashable {
    let id: String
    let gorevNo: String
    let gorevTanimi: String?
    let durum: String
    let talepTarihi: Date?
    let cikisTarihi: Date?
}

struct VehicleWorkLogBriefDTO: Codable, Identifiable, Hashable {
    let id: String
    let tarih: Date?
    let girisSaati: String
    let cikisSaati: String
    let calismaSaati: Double
    let soforAdi: String?
}

struct VehicleRequestDTO: Encodable {
    var plaka: String
    var ad: String?
    var vehicleTypeId: String?
    var marka: String?
    var model: String?
    var modelYili: Int?
    var yakitTipi: String?
    var kapasite: String?
    var sayacDeger: Double?
    var sayacBirim: String?
    var normTuketim: Double?
    var muayeneTarihi: String?
    var sigortaBitis: String?
    var sonBakimTarihi: String?
    var sonrakiBakimTarihi: String?
    var bakimKmSaati: String?
    var departmentId: String?
    var atananSoforId: String?
    var envanterDurumu: String
    var operasyonDurumu: String
    var notlar: String?
}

// MARK: - Bakım

struct MaintenanceDTO: Codable, Identifiable, Hashable {
    let id: String
    let vehicleId: String
    let plaka: String
    let aracAdi: String?
    let bakimTarihi: Date?
    let bakimTuru: String
    let durum: String
    let yapilanIslemler: String?
    let kullanilanMalzeme: String?
    let maliyet: Double?
    let yapanFirmaPersonel: String?
    let sonrakiBakimTarihi: Date?
    let otomatikOlusturuldu: Bool
    let createdAt: Date?
}

struct MaintenanceRequestDTO: Encodable {
    var vehicleId: String
    var bakimTarihi: String?
    var bakimTuru: String
    var yapilanIslemler: String?
    var kullanilanMalzeme: String?
    var maliyet: Double?
    var yapanFirmaPersonel: String?
    var sonrakiBakimTarihi: String?
    var durum: String
}

// MARK: - Yakıt

struct FuelRecordFullDTO: Codable, Identifiable, Hashable {
    let id: String
    let vehicleId: String
    let plaka: String
    let aracAdi: String?
    let tarih: Date?
    let yakitTuru: String
    let litre: Double?
    let birimFiyat: Double?
    let tutar: Double?
    let sayac: Double?
    let sorumluPersonelId: String?
    let sorumluPersonelAdi: String?
    let vehicleTaskId: String?
    let gunlukCalismadan: Bool
}

struct FuelListDTO: Decodable {
    let items: [FuelRecordFullDTO]
    let total: Int
    let page: Int
    let pageSize: Int
    let ozet: FuelSummaryTotalsDTO
}

struct FuelSummaryTotalsDTO: Decodable {
    let toplamLitre: Double
    let toplamTutar: Double
}

// MARK: - Akaryakıt analizi

struct AkaryakitResponseDTO: Decodable {
    let ay: String
    let ayIndex: Int
    let analiz: [AkaryakitAnalysisRowDTO]
    let aylik: [AkaryakitMonthlyRowDTO]
    let toplam: AkaryakitTotalsDTO
    let aylar: [String]
}

struct AkaryakitAnalysisRowDTO: Decodable, Identifiable, Hashable {
    let vehicleId: String
    let plaka: String
    let mudurluk: String?
    let sayacTipi: String
    let toplamLitre: Double
    let toplamTutar: Double
    let sayacFarki: Double
    let gercekTuketim: Double?
    let norm: Double
    let durum: String?
    var id: String { vehicleId }
}

struct AkaryakitMonthlyRowDTO: Decodable, Identifiable, Hashable {
    let vehicleId: String
    let plaka: String
    let yakit: String
    let litre: Double
    let tutar: Double
    let adet: Int
    let ortBirimFiyat: Double?
    var id: String { vehicleId }
}

struct AkaryakitTotalsDTO: Decodable, Hashable {
    let litre: Double
    let tutar: Double
    let adet: Int
}

struct FuelRequestDTO: Encodable {
    var vehicleId: String
    var tarih: String?
    var yakitTuru: String
    var litre: Double
    var birimFiyat: Double
    var sayac: Double?
    var sorumluPersonelId: String?
    var vehicleTaskId: String?
}
