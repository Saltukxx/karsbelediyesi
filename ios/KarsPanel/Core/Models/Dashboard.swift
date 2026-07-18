import Foundation

struct DashboardDTO: Decodable {
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
