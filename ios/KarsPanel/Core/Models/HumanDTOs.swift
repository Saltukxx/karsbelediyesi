import Foundation

// MARK: - Personel

struct PersonnelFullDTO: Codable, Identifiable, Hashable {
    let id: String
    let adSoyad: String
    let unvan: String?
    let departmentId: String?
    let mudurluk: String?
    let telefon: String?
    let iseGirisTarihi: Date?
    let durum: String
    let not: String?
    let saatUcret: Double?
    let userId: String?
}

struct PersonnelCardDTO: Decodable {
    let personel: PersonnelFullDTO
    let mesailer: [PersonnelWorkLogDTO]
    let ozet: PersonnelTotalsDTO
}

struct PersonnelTotalsDTO: Decodable {
    let toplamMesaiSaat: Double
    let toplamSaat: Double
    let saatUcret: Double?
}

struct PersonnelRequestDTO: Encodable {
    var adSoyad: String
    var unvan: String?
    var departmentId: String?
    var telefon: String?
    var iseGirisTarihi: String?
    var durum: String
    var not: String?
    var saatUcret: Double?
}

// MARK: - Mesai / günlük çalışma

struct WorkLogsResponseDTO: Decodable {
    let personelMesaileri: PagedResponse<PersonnelWorkLogDTO>
    let aracCalismalari: PagedResponse<VehicleWorkLogDTO>
}

struct PersonnelWorkLogDTO: Codable, Identifiable, Hashable {
    let id: String
    let tarih: Date?
    let girisSaati: String
    let cikisSaati: String
    let normalSaat: Double
    let mesaiSaat: Double
    let toplamSaat: Double
    let calismaTipi: String
    let yapilanIs: String?
    // Yalnızca liste yanıtında bulunan alanlar
    var personnelId: String?
    var personelAdi: String?
    var unvan: String?
    var gorevlendirilenBirimId: String?
    var gorevlendirilenBirim: String?
    var notlar: String?
    var onaylayan: String?
}

struct VehicleWorkLogDTO: Codable, Identifiable, Hashable {
    let id: String
    let vehicleId: String
    let plaka: String
    let aracAdi: String?
    let tarih: Date?
    let driverId: String?
    let soforAdi: String?
    let gorevTanimi: String?
    let yerBolge: String?
    let girisSaati: String
    let cikisSaati: String
    let calismaSaati: Double
    let yakitLitre: Double?
    let yakitTutari: Double?
    let notlar: String?
    let onaylayan: String?
}

struct PersonnelWorkLogRequestDTO: Encodable {
    var personnelId: String
    var tarih: String
    var girisSaati: String
    var cikisSaati: String
    var calismaTipi: String
    var yapilanIs: String?
    var gorevlendirilenBirimId: String?
    var notlar: String?
}

struct VehicleWorkLogRequestDTO: Encodable {
    var vehicleId: String
    var tarih: String
    var girisSaati: String
    var cikisSaati: String
    var driverId: String?
    var soforAdi: String?
    var gorevTanimi: String?
    var yerBolge: String?
    var yakitLitre: Double?
    var yakitTuru: String?
    var birimFiyat: Double?
    var notlar: String?
}
