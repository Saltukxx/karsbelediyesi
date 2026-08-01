import Foundation

/// Sunucu enum'larının Swift karşılıkları. `rawValue`'lar Prisma enum
/// değerleriyle birebir aynıdır; rol matrisi gibi bu da parite testine tabidir.

enum VehicleInventoryStatus: String, KBSelectableOption {
    case AKTIF
    case BAKIMDA
    case ARIZALI
    case HURDAYA_AYRILDI

    var displayName: String {
        switch self {
        case .AKTIF: return "Aktif"
        case .BAKIMDA: return "Bakımda"
        case .ARIZALI: return "Arızalı"
        case .HURDAYA_AYRILDI: return "Hurdaya Ayrıldı"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .AKTIF: return .success
        case .BAKIMDA: return .warning
        case .ARIZALI: return .danger
        case .HURDAYA_AYRILDI: return .neutral
        }
    }
}

enum VehicleOperationStatus: String, KBSelectableOption {
    case MUSAIT
    case GOREVDE
    case BAKIMDA
    case ARIZALI
    case PLANLI_BAKIM

    var displayName: String {
        switch self {
        case .MUSAIT: return "Müsait"
        case .GOREVDE: return "Görevde"
        case .BAKIMDA: return "Bakımda"
        case .ARIZALI: return "Arızalı"
        case .PLANLI_BAKIM: return "Planlı Bakım"
        }
    }
}

enum VehicleFuelType: String, KBSelectableOption {
    case DIZEL
    case BENZIN
    case LPG
    case ELEKTRIK
    case HIBRIT
    case DIGER

    var displayName: String {
        switch self {
        case .DIZEL: return "Dizel"
        case .BENZIN: return "Benzin"
        case .LPG: return "LPG"
        case .ELEKTRIK: return "Elektrik"
        case .HIBRIT: return "Hibrit"
        case .DIGER: return "Diğer"
        }
    }
}

enum MeterUnit: String, KBSelectableOption {
    case KM
    case SAAT

    var displayName: String {
        switch self {
        case .KM: return "Kilometre"
        case .SAAT: return "Çalışma saati"
        }
    }
}

enum MaintenanceKind: String, KBSelectableOption {
    case PERIYODIK
    case BUYUK_BAKIM
    case ARIZA_ONARIMI
    case LASTIK
    case YAG_DEGISIMI
    case DIGER

    var displayName: String {
        switch self {
        case .PERIYODIK: return "Periyodik"
        case .BUYUK_BAKIM: return "Büyük Bakım"
        case .ARIZA_ONARIMI: return "Arıza Onarımı"
        case .LASTIK: return "Lastik"
        case .YAG_DEGISIMI: return "Yağ Değişimi"
        case .DIGER: return "Diğer"
        }
    }
}

enum MaintenanceStatus: String, KBSelectableOption {
    case PLANLANDI
    case DEVAM_EDIYOR
    case TAMAMLANDI

    var displayName: String {
        switch self {
        case .PLANLANDI: return "Planlandı"
        case .DEVAM_EDIYOR: return "Devam Ediyor"
        case .TAMAMLANDI: return "Tamamlandı"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .PLANLANDI: return .info
        case .DEVAM_EDIYOR: return .warning
        case .TAMAMLANDI: return .success
        }
    }
}

enum FuelKind: String, KBSelectableOption {
    case MOTORIN
    case BENZIN
    case LPG
    case ELEKTRIK
    case DIGER

    var displayName: String {
        switch self {
        case .MOTORIN: return "Motorin"
        case .BENZIN: return "Benzin"
        case .LPG: return "LPG"
        case .ELEKTRIK: return "Elektrik"
        case .DIGER: return "Diğer"
        }
    }
}

enum PersonnelStatus: String, KBSelectableOption {
    case AKTIF
    case IZINLI
    case RAPORLU
    case AYRILDI

    var displayName: String {
        switch self {
        case .AKTIF: return "Aktif"
        case .IZINLI: return "İzinli"
        case .RAPORLU: return "Raporlu"
        case .AYRILDI: return "Ayrıldı"
        }
    }

    var badgeTone: StatusBadgeTone {
        switch self {
        case .AKTIF: return .success
        case .IZINLI: return .info
        case .RAPORLU: return .warning
        case .AYRILDI: return .neutral
        }
    }
}

enum WorkKind: String, KBSelectableOption {
    case NORMAL_MESAI
    case FAZLA_MESAI
    case RESMI_TATIL
    case HAFTA_SONU
    case IZIN
    case RAPOR

    var displayName: String {
        switch self {
        case .NORMAL_MESAI: return "Normal Mesai"
        case .FAZLA_MESAI: return "Fazla Mesai"
        case .RESMI_TATIL: return "Resmi Tatil"
        case .HAFTA_SONU: return "Hafta Sonu"
        case .IZIN: return "İzin"
        case .RAPOR: return "Rapor"
        }
    }
}

enum StockMovementKind: String, KBSelectableOption {
    case GIRIS
    case CIKIS

    var displayName: String {
        switch self {
        case .GIRIS: return "Giriş"
        case .CIKIS: return "Çıkış"
        }
    }

    var badgeTone: StatusBadgeTone {
        self == .GIRIS ? .success : .warning
    }
}

enum BitumMovementKind: String, KBSelectableOption {
    case ALIS
    case TASIMA
    case KULLANIM

    var displayName: String {
        switch self {
        case .ALIS: return "Alış"
        case .TASIMA: return "Taşıma"
        case .KULLANIM: return "Kullanım"
        }
    }
}

/// `StatusBadge.Tone` SwiftUI'ya bağlı olduğu için enum'larda ara tip kullanılır;
/// böylece bu dosya UI'dan bağımsız kalır ve testlerde derlenebilir.
enum StatusBadgeTone {
    case neutral, success, warning, danger, info, accent
}

/// Sunucudan gelen serbest metin durumları için etiket tonu tahmini.
enum StatusTone {
    static func forStock(_ durum: String) -> StatusBadgeTone {
        switch durum {
        case "KRITIK": return .danger
        case "AZ", "DIKKAT", "DUSUK": return .warning
        case "YETERLI", "NORMAL": return .success
        default: return .neutral
        }
    }
}
