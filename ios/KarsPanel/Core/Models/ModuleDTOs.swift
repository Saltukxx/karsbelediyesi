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

struct LocationPingRequestDTO: Encodable {
    let lat: Double
    let lng: Double
    let hiz: Double?
}

struct LocationPingResponseDTO: Decodable {
    let ok: Bool
    let vehicleId: String?
}
