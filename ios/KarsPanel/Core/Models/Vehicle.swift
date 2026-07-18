import Foundation

struct VehicleDTO: Codable, Identifiable, Hashable {
    let id: String
    let plaka: String?
    let marka: String?
    let model: String?
    let cins: String?
    let envanterDurumu: String?
    let operasyonDurumu: String?
    let sayacDeger: Double?
    let atananSoforId: String?
}

struct VehicleTaskDTO: Codable, Identifiable, Hashable {
    let id: String
    let gorevNo: String?
    let durum: String?
    let talepTarihi: Date?
    let baslangicTarihi: Date?
    let bitisTarihi: Date?
    let aciklama: String?
    let vehicleId: String?
    let vehicle: VehicleSummaryDTO?
    let driverId: String?
    let talepEdenDepartmentId: String?
}
