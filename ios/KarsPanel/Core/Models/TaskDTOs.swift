import Foundation

/// `GorevDurum` — görev formunun durum kolonu.
enum TaskStatus: String, KBSelectableOption {
    case PLANLANDI
    case DEVAM_EDIYOR
    case TAMAMLANDI
    case IPTAL_EDILDI

    var displayName: String {
        switch self {
        case .PLANLANDI: return "Planlandı"
        case .DEVAM_EDIYOR: return "Devam Ediyor"
        case .TAMAMLANDI: return "Tamamlandı"
        case .IPTAL_EDILDI: return "İptal Edildi"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .PLANLANDI: return .info
        case .DEVAM_EDIYOR: return .warning
        case .TAMAMLANDI: return .success
        case .IPTAL_EDILDI: return .neutral
        }
    }

    var baslatilabilir: Bool { self == .PLANLANDI }
    var kapatilabilir: Bool { self == .PLANLANDI || self == .DEVAM_EDIYOR }
}

/// Görev kapatılırken seçilebilen son durumlar.
enum TaskClosingStatus: String, KBSelectableOption {
    case TAMAMLANDI
    case IPTAL_EDILDI

    var displayName: String {
        switch self {
        case .TAMAMLANDI: return "Tamamlandı"
        case .IPTAL_EDILDI: return "İptal Edildi"
        }
    }
}

// MARK: - Detay

/// `GET /api/v1/tasks/[id]`
struct TaskDetailDTO: Decodable, Identifiable {
    let id: String
    let gorevNo: String
    let durum: String
    let talepTarihi: Date?
    let gorevYeri: String?
    let gorevTanimi: String?
    let cikisTarihi: Date?
    let girisTarihi: Date?
    let sureSaat: Double?
    let kmSayacCikis: Double?
    let kmSayacGiris: Double?
    let kmFarki: Double?
    let maliyet: Double?
    let not: String?
    let vehicleId: String
    let vehicle: TaskVehicleDTO
    let driverId: String?
    let sofor: TaskDriverDTO?
    let talepEdenDepartmentId: String?
    let talepEdenMudurluk: String?
    let onaylayanId: String?
    let onaylayan: String?
    let dispatch: TaskDispatchDTO?
    let takipOzeti: TaskTrackSummaryDTO?

    var durumu: TaskStatus? { TaskStatus(rawValue: durum) }
}

struct TaskVehicleDTO: Decodable, Hashable {
    let id: String
    let plaka: String
    let ad: String?
    let tip: String?
}

struct TaskDriverDTO: Decodable, Hashable {
    let id: String
    let ad: String?
    let telefon: String?
}

struct TaskDispatchDTO: Decodable, Hashable {
    let id: String
    /// KIS | COP | TEMIZLIK
    let tip: String
    let routeAd: String?
}

struct TaskTrackSummaryDTO: Decodable, Hashable {
    let sonuc: String
    let uyumYuzde: Double?
    let kapsamaYuzde: Double?
}

// MARK: - İstekler

struct TaskCreateRequestDTO: Encodable {
    var vehicleId: String
    var talepEdenDepartmentId: String?
    var driverId: String?
    var gorevYeri: String?
    var gorevTanimi: String?
    /// ISO 8601 — tarih ve saat birlikte gönderilir
    var cikisTarihi: String?
    var girisTarihi: String?
    var kmSayacCikis: Double?
    var kmSayacGiris: Double?
    var onaylayanId: String?
    var durum: String
    var not: String?
    var maliyet: Double?
}

struct TaskStartRequestDTO: Encodable {
    let action = "start"
    var kmSayacCikis: Double?
}

struct TaskCloseRequestDTO: Encodable {
    let action = "close"
    var girisTarihi: String?
    var kmSayacGiris: Double?
    var durum: String
}

// MARK: - Takip raporu

/// `GET /api/v1/tasks/[id]/takip` — planlanan rota ↔ GPS izi karşılaştırması.
struct TaskTrackReportDTO: Decodable {
    let gorevNo: String
    let gorevTanimi: String?
    let plaka: String
    let soforAdi: String?
    let cikisTarihi: Date?
    let girisTarihi: Date?
    /// Analiz yalnızca dispatch rotasına bağlı görevler için üretilir.
    let dispatchVar: Bool
    let analiz: TaskTrackAnalysisDTO?
    let sapmalar: [TrackDeviationDTO]
    let duraklamalar: [TrackStopDTO]
    let veriBosluklari: [TrackGapDTO]
    let zamanCizelgesi: [TrackEventDTO]
    let toplamSapmaDk: Double
    let toplamDuraklamaDk: Double
    let harita: TrackMapDTO?
}

struct TaskTrackAnalysisDTO: Decodable {
    /// KIS | COP | TEMIZLIK
    let tip: String
    let routeAd: String?
    /// TAMAMLANDI | KISMEN | YETERSIZ | VERI_YOK
    let sonuc: String
    /// IYI | ZAYIF | YOK
    let veriKalitesi: String
    let notlar: String?
    let rotaGiris: Date?
    let rotaCikis: Date?
    let sureDk: Double?
    let uyumYuzde: Double?
    let kapsamaYuzde: Double?
    let maxSapmaM: Double?
    let ortSapmaM: Double?
    let ortalamaHizKmh: Double?
    let maxHizKmh: Double?
    let toplamMesafeKm: Double?
    let pingSayisi: Int?
    let ortPingAraligiSn: Double?
    let guncellemeTarihi: Date?

    var veriYok: Bool { sonuc == "VERI_YOK" }
}

struct TrackDeviationDTO: Decodable, Hashable {
    let baslangicMs: Double
    let bitisMs: Double
    let sureDk: Double
    let maxMesafeM: Double
    let lat: Double
    let lng: Double
    let izler: [[Double]]
}

struct TrackStopDTO: Decodable, Hashable {
    let lat: Double
    let lng: Double
    let baslangicMs: Double
    let bitisMs: Double
    let sureDk: Double
    let rotaUzerinde: Bool
}

struct TrackGapDTO: Decodable, Hashable {
    let baslangicMs: Double
    let bitisMs: Double
    let sureDk: Double
}

struct TrackEventDTO: Decodable, Hashable, Identifiable {
    let tip: String
    let baslangicMs: Double
    /// Anlık olaylarda (rotaya giriş/çıkış) null
    let bitisMs: Double?
    let sureDk: Double?
    let maxMesafeM: Double?

    var id: String { "\(tip)-\(baslangicMs)" }
    var olay: TrackEventKind? { TrackEventKind(rawValue: tip) }
}

/// `TakipOlayTipi` — zaman çizelgesi satır tipleri.
enum TrackEventKind: String {
    case ROTA_GIRIS
    case SAPMA
    case DURAKLAMA_ROTADA
    case DURAKLAMA_ROTA_DISI
    case VERI_BOSLUGU
    case ROTA_CIKIS

    var displayName: String {
        switch self {
        case .ROTA_GIRIS: return "Rotaya giriş"
        case .SAPMA: return "Rota dışı sapma"
        case .DURAKLAMA_ROTADA: return "Duraklama (rotada)"
        case .DURAKLAMA_ROTA_DISI: return "Duraklama (rota dışı)"
        case .VERI_BOSLUGU: return "Veri boşluğu"
        case .ROTA_CIKIS: return "Rotadan çıkış"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .ROTA_GIRIS: return .success
        case .SAPMA: return .warning
        case .DURAKLAMA_ROTADA: return .info
        case .DURAKLAMA_ROTA_DISI: return .danger
        case .VERI_BOSLUGU: return .accent
        case .ROTA_CIKIS: return .danger
        }
    }
}

struct TrackMapDTO: Decodable {
    /// Planlanan rota [[lat,lng], ...]
    let planlanan: [[Double]]
    /// Kat edilmeyen rota bölümleri
    let eksikSegmentler: [[[Double]]]
    /// GPS izi [[lat,lng,tsMs,hiz|null], ...] — hız alanı null olabilir
    let iz: [[Double?]]

    /// İzin çizilebilir noktaları; konumu eksik ping'ler düşer.
    var izNoktalari: [[Double]] {
        iz.compactMap { satir in
            guard satir.count >= 2, let lat = satir[0], let lng = satir[1] else {
                return nil
            }
            return [lat, lng]
        }
    }
}

extension TaskTrackReportDTO {
    /// Rapor başlığının alt satırı (web `PageHeader` açıklaması).
    var baslikAltMetni: String {
        if let analiz {
            return [
                TrackReportLabels.dispatchTipi(analiz.tip),
                analiz.routeAd,
                plaka,
                soforAdi,
            ]
                .compactMap { $0 }
                .joined(separator: " · ")
        }
        return gorevTanimi ?? "GPS izi ↔ planlanan rota karşılaştırması"
    }
}

/// Rapor başlıklarının sunum metinleri; web `SONUC_LABEL` / `KALITE_LABEL`.
enum TrackReportLabels {
    static func sonuc(_ raw: String) -> (label: String, tone: StatusBadgeTone) {
        switch raw {
        case "TAMAMLANDI": return ("Tamamlandı", .success)
        case "KISMEN": return ("Kısmen tamamlandı", .warning)
        case "YETERSIZ": return ("Yetersiz", .danger)
        case "VERI_YOK": return ("Veri yok", .neutral)
        default: return (raw, .neutral)
        }
    }

    static func veriKalitesi(_ raw: String) -> (label: String, tone: StatusBadgeTone) {
        switch raw {
        case "IYI": return ("Veri kalitesi: İyi", .success)
        case "ZAYIF": return ("Veri kalitesi: Zayıf", .warning)
        case "YOK": return ("Veri yok", .neutral)
        default: return (raw, .neutral)
        }
    }

    /// Dispatch iş tipi (web `tipLabel`).
    static func dispatchTipi(_ raw: String) -> String {
        switch raw {
        case "KIS": return "Kış operasyonu"
        case "COP": return "Çöp toplama"
        case "TEMIZLIK": return "Yol temizliği"
        default: return raw
        }
    }
}
