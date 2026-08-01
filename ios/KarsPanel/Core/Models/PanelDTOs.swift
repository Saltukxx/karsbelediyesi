import Foundation

/// `GET /api/search` — komut paleti araması
struct SearchResponseDTO: Decodable {
    let results: [SearchResultDTO]
}

struct SearchResultDTO: Decodable, Identifiable, Hashable {
    /// "Şikayet" | "Araç" | "Personel" | "Görev"
    let type: String
    let label: String
    let sub: String?
    let href: String

    var id: String { "\(type)-\(href)-\(label)" }
}

/// `GET /api/v1/notifications`
struct NotificationListDTO: Decodable {
    let unread: Int
    let items: [NotificationDTO]
}

struct NotificationDTO: Decodable, Identifiable, Hashable {
    let id: String
    let tip: String?
    let baslik: String?
    let mesaj: String?
    let href: String?
    let okundu: Bool
    let createdAt: Date?

    /// Bildirime dokununca gidilecek ekran; çözülemeyen yollar nil döner.
    var hedef: KBDeepLink? { href.flatMap(KBDeepLink.init(href:)) }
}

/// `PATCH /api/v1/notifications/[id]` ve `POST .../tumunu-oku`
struct NotificationReadDTO: Decodable {
    let unread: Int
}

// MARK: - APNs cihaz kaydı

/// `POST /api/v1/devices`
struct DeviceRegisterRequestDTO: Encodable {
    let token: String
    let platform: String
    let uygulama: String?
    let cihaz: String?
}

struct DeviceUnregisterRequestDTO: Encodable {
    let token: String
}

struct DeviceRegistrationDTO: Decodable {
    let id: String
    let platform: String
    let aktif: Bool
}

/// `POST /api/v1/sla/tarama` — komuta ekranından elle tetiklenen SLA taraması
struct SlaScanResultDTO: Decodable {
    let calisti: Bool
    let sikayet: Int
    let gecikenKisRota: Int
    let gecikenCopRota: Int

    var ozet: String {
        guard calisti else { return "Tarama az önce yapılmıştı, atlandı." }
        let toplam = sikayet + gecikenKisRota + gecikenCopRota
        return toplam == 0
            ? "Tarama tamam — geciken iş yok."
            : "Tarama tamam — \(sikayet) şikayet, \(gecikenKisRota) kış, \(gecikenCopRota) çöp rotası gecikmiş."
    }
}
