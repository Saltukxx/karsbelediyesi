import Foundation

/// `GET /api/v1/komuta` — canlı operasyon görünümünün tek toplama noktası.
/// Salt okunur; 30 saniyede bir yeniden çekilir.
struct KomutaVeriDTO: Decodable {
    let zaman: Date
    let kpi: KomutaKpiDTO
    let araclar: [KomutaAracDTO]
    let sikayetler: [KomutaSikayetPinDTO]
    let bekleyenler: [KomutaBekleyenDTO]
    let gecikenRotalar: [KomutaGecikenRotaDTO]
}

struct KomutaKpiDTO: Decodable {
    let acikSikayet: Int
    let slaLt24: Int
    let sla1to3: Int
    let slaGt3: Int
    let bekleyenAtama: Int
    let gecikenRota: Int
    let devamEdenGorev: Int
    let tazeKonumluArac: Int
    let toplamArac: Int
    let bugunOperasyon: Int
}

struct KomutaAracDTO: Decodable, Identifiable, Hashable {
    let id: String
    let plaka: String
    let tip: String?
    let lat: Double?
    let lng: Double?
    let konumZamani: Date?
    /// Konum 15 dakikadan taze mi
    let taze: Bool
    let aktifGorev: KomutaAracGorevDTO?
    let rotaUzaklikM: Double?
    /// Sunucu sapma eşiğine göre hesaplar; ölçülemiyorsa nil
    let rotada: Bool?

    var koordinat: KBCoordinate? {
        guard let lat, let lng else { return nil }
        return KBCoordinate(lat: lat, lng: lng)
    }

    /// Rozet metni: "rotada" / "rota dışı (320 m)"
    var rotaDurumu: String? {
        guard let rotada else { return nil }
        if rotada { return "rotada" }
        guard let rotaUzaklikM else { return "rota dışı" }
        return "rota dışı (\(Int(rotaUzaklikM.rounded())) m)"
    }
}

struct KomutaAracGorevDTO: Decodable, Hashable {
    let gorevNo: String
    let tanim: String?
}

/// Açık şikayetlerin yaş kovaları — harita rengi ve geciken iş listesi bunu kullanır.
enum KomutaSlaBucket: String, Decodable {
    case lt24
    case d1to3
    case gt3

    var displayName: String {
        switch self {
        case .lt24: return "24 saatten yeni"
        case .d1to3: return "1–3 gün"
        case .gt3: return "3 günden eski"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .lt24: return .info
        case .d1to3: return .warning
        case .gt3: return .danger
        }
    }

    var gecikmis: Bool { self != .lt24 }
}

struct KomutaSikayetPinDTO: Decodable, Identifiable, Hashable {
    let id: String
    let sikayetNo: String
    let oncelik: String
    let aciklama: String?
    let lat: Double
    let lng: Double
    let kayitTarihi: Date
    let bucket: KomutaSlaBucket

    var koordinat: KBCoordinate { KBCoordinate(lat: lat, lng: lng) }
}

/// Onay bekleyen sevkiyat önerisi (DispatchJob durumu ONERILDI).
struct KomutaBekleyenDTO: Decodable, Identifiable, Hashable {
    let jobId: String
    let tip: DispatchTip
    let routeAd: String
    let plaka: String?
    let aracTip: String?
    let mesafeKm: Double?
    let sureDk: Double?
    let tahmini: Bool
    /// Skorlama motorunun tek satırlık açıklaması
    let gerekceOzet: String?
    let createdAt: Date

    var id: String { jobId }

    var aracMetni: String {
        var parcalar = ["Önerilen: \(plaka ?? "—")"]
        if let aracTip { parcalar.append("(\(aracTip))") }
        if let sureDk { parcalar.append("· ~\(KBDurationFormat.dakika(sureDk))") }
        if tahmini { parcalar.append("(kuş uçuşu)") }
        return parcalar.joined(separator: " ")
    }
}

struct KomutaGecikenRotaDTO: Decodable, Identifiable, Hashable {
    let id: String
    let tip: DispatchTip
    let ad: String
    /// Kış rotalarında 1–3 öncelik; çöpte nil
    let oncelik: Int?
    /// Kış rotalarında 12/18 saatlik eşik; çöpte nil
    let esikSaat: Int?
    let sonIslem: Date?
    let koordinatlar: [[Double]]

    /// Aynı id farklı tiplerde tekrar edebilir
    var listeId: String { "\(tip.rawValue):\(id)" }

    var gecikmeMetni: String {
        switch tip {
        case .KIS:
            guard let oncelik, let esikSaat else { return "Gecikmiş" }
            return "Öncelik-\(oncelik) — \(esikSaat) saattir işlem yok"
        case .COP:
            return "Bugün toplanmalıydı"
        case .TEMIZLIK:
            return "Gecikmiş"
        }
    }
}

/// Komuta ekranının yan panelindeki filo sayaçları. Üç kova filoyu tam olarak
/// böler: görevdeki araç konum göndermese de "görevde" sayılır, "konumsuz"
/// yalnızca sevk edilemeyecek boştaki araçları gösterir.
struct KomutaFiloOzeti {
    let gorevde: Int
    let bosta: Int
    let konumsuz: Int

    init(araclar: [KomutaAracDTO]) {
        let bostakiler = araclar.filter { $0.aktifGorev == nil }
        gorevde = araclar.count - bostakiler.count
        bosta = bostakiler.filter { $0.koordinat != nil }.count
        konumsuz = bostakiler.count - bosta
    }
}
