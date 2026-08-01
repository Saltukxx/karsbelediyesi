import Foundation

/// Sevkiyat rotalarının üç türü; kış/çöp/temizlik modülleri aynı motoru kullanır.
enum DispatchTip: String, Codable, CaseIterable, Identifiable {
    case KIS
    case COP
    case TEMIZLIK

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .KIS: return "Kış"
        case .COP: return "Çöp"
        case .TEMIZLIK: return "Temizlik"
        }
    }

    var destination: NavDestination {
        switch self {
        case .KIS: return .kis
        case .COP: return .cop
        case .TEMIZLIK: return .temizlik
        }
    }
}

/// `GET /api/v1/dispatch/adaylar?tip=&routeId=`
struct DispatchAdaylarDTO: Decodable {
    let tip: DispatchTip
    let routeId: String
    let routeAd: String
    let adaylar: [DispatchAdayDTO]
}

/// Skorlanmış araç adayı. Rota geometrisi istemciye gönderilmez.
struct DispatchAdayDTO: Decodable, Identifiable, Hashable {
    let vehicleId: String
    let plaka: String
    let tip: String?
    let sureDk: Double
    let mesafeKm: Double
    /// OSRM yerine kuş uçuşu tahmini kullanıldı
    let tahmini: Bool
    /// 0–100
    let skor: Int
    let kirilim: DispatchSkorKirilimDTO
    let etiketler: [String]
    /// Konumu bayat — otomatik önerilmez ama elle seçilebilir
    let bayat: Bool

    var id: String { vehicleId }

    var mesafeMetni: String {
        let sure = KBDurationFormat.dakika(sureDk)
        let mesafe = KBNumberFormat.miktar(mesafeKm, birim: "km")
        return tahmini ? "~\(sure) · \(mesafe) (kuş uçuşu)" : "~\(sure) · \(mesafe)"
    }
}

struct DispatchSkorKirilimDTO: Decodable, Hashable {
    let sure: Int
    let tip: Int
    let tazelik: Int
    let yuk: Int
    let yakit: Int

    /// Web'deki "süre 40 · tip 20 · konum 10 · yük 8 · yakıt 5" satırı
    var ozet: String {
        "süre \(sure) · tip \(tip) · konum \(tazelik) · yük \(yuk) · yakıt \(yakit)"
    }
}

/// `POST /api/v1/dispatch/oner` — üretilen bekleyen öneri (uygun araç yoksa null)
struct DispatchOneriDTO: Decodable {
    let jobId: String
    let tip: DispatchTip
    let routeId: String
    let routeAd: String
    let vehicleId: String
    let plaka: String
    let aracTip: String?
    let mesafeKm: Double
    let sureDk: Double
    let tahmini: Bool
}

/// `POST /api/v1/dispatch/ata` ve `/arac-ata` — açılan görev
struct DispatchAtamaDTO: Decodable {
    let gorevNo: String
    let taskId: String
    let jobId: String
}

struct DispatchReddetDTO: Decodable {
    let jobId: String
}

// MARK: - İstekler

struct DispatchRotaRequestDTO: Encodable {
    let tip: String
    let routeId: String
}

struct DispatchAracRequestDTO: Encodable {
    let tip: String
    let routeId: String
    let vehicleId: String
}

struct DispatchOneriRequestDTO: Encodable {
    let jobId: String
}
