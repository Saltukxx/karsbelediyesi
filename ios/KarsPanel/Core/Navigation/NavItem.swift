import Foundation

enum NavGroupId: String, CaseIterable {
    case operasyon
    case vatandas
    case saha
    case filoUretim
    case kurum

    var label: String {
        switch self {
        case .operasyon: return "Operasyon"
        case .vatandas: return "Vatandaş & Görev"
        case .saha: return "Saha & Harita"
        case .filoUretim: return "Filo & Üretim"
        case .kurum: return "Kurum Yönetimi"
        }
    }
}

enum NavDestination: String, Hashable, CaseIterable {
    case dashboard
    case komuta
    case raporlar
    case sikayetler
    case islerim
    case whatsapp
    case gorevler
    case kontrol
    case harita
    case parsel
    case kis
    case cop
    case temizlik
    case araclar
    case bakim
    case yakit
    case akaryakit
    case malzemeDepo
    case beton
    case agrega
    case bitum
    case personel
    case gunlukCalisma
    case tanimlar
    case denetim

    var href: String {
        switch self {
        case .dashboard: return "/"
        case .komuta: return "/komuta"
        case .raporlar: return "/raporlar"
        case .sikayetler: return "/sikayetler"
        case .islerim: return "/islerim"
        case .whatsapp: return "/whatsapp"
        case .gorevler: return "/gorevler"
        case .kontrol: return "/kontrol-listeleri"
        case .harita: return "/harita"
        case .parsel: return "/parsel"
        case .kis: return "/kis"
        case .cop: return "/cop"
        case .temizlik: return "/temizlik"
        case .araclar: return "/araclar"
        case .bakim: return "/bakim"
        case .yakit: return "/yakit"
        case .akaryakit: return "/akaryakit"
        case .malzemeDepo: return "/malzeme-depo"
        case .beton: return "/beton"
        case .agrega: return "/agrega"
        case .bitum: return "/bitum"
        case .personel: return "/personel"
        case .gunlukCalisma: return "/gunluk-calisma"
        case .tanimlar: return "/tanimlar"
        case .denetim: return "/denetim"
        }
    }

    var label: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .komuta: return "Komuta Ekranı"
        case .raporlar: return "Raporlar"
        case .sikayetler: return "Şikayet Kayıt & Takip"
        case .islerim: return "İşlerim"
        case .whatsapp: return "WhatsApp Kuyruğu"
        case .gorevler: return "Görevlendirme"
        case .kontrol: return "Kontrol Listeleri"
        case .harita: return "Yol Haritası"
        case .parsel: return "Parsel Sorgu"
        case .kis: return "Kış Operasyonu"
        case .cop: return "Çöp Toplama"
        case .temizlik: return "Yol Temizliği"
        case .araclar: return "Araç Envanteri"
        case .bakim: return "Bakım Takip"
        case .yakit: return "Yakıt Takip"
        case .akaryakit: return "Akaryakıt Analizi"
        case .malzemeDepo: return "Malzeme / Depo"
        case .beton: return "Beton Reçeteleri"
        case .agrega: return "Agrega Maliyet"
        case .bitum: return "Bitüm Takip"
        case .personel: return "Personel"
        case .gunlukCalisma: return "Günlük Çalışma"
        case .tanimlar: return "Tanımlar & Yönetim"
        case .denetim: return "Denetim İzi"
        }
    }

    var shortLabel: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .komuta: return "Komuta"
        case .raporlar: return "Rapor"
        case .sikayetler: return "Şikayet"
        case .islerim: return "İşlerim"
        case .whatsapp: return "WhatsApp"
        case .gorevler: return "Görev"
        case .kontrol: return "Kontrol"
        case .harita: return "Harita"
        case .parsel: return "Parsel"
        case .kis: return "Kış"
        case .cop: return "Çöp"
        case .temizlik: return "Temizlik"
        case .araclar: return "Araçlar"
        case .bakim: return "Bakım"
        case .yakit: return "Yakıt"
        case .akaryakit: return "Analiz"
        case .malzemeDepo: return "Depo"
        case .beton: return "Beton"
        case .agrega: return "Agrega"
        case .bitum: return "Bitüm"
        case .personel: return "Personel"
        case .gunlukCalisma: return "Mesai"
        case .tanimlar: return "Tanım"
        case .denetim: return "Denetim"
        }
    }

    /// Modül menüsündeki alt satır; web'deki `NAV_ITEMS[].description` ile aynı metinler.
    var summary: String {
        switch self {
        case .dashboard: return "Kritik göstergeler ve günlük operasyon özeti"
        case .komuta: return "Canlı saha durumu ve akıllı görevlendirme"
        case .raporlar: return "Performans, maliyet ve dönemsel analizler"
        case .sikayetler: return "Vatandaş başvuruları ve çözüm süreçleri"
        case .islerim: return "Size atanan açık ve devam eden işler"
        case .whatsapp: return "Gelen mesajları inceleme ve yanıtlama"
        case .gorevler: return "Araç, personel ve görev planlama"
        case .kontrol: return "Saha kontrolleri, onay ve takip"
        case .harita: return "Yollar, engeller ve şikayet katmanları"
        case .parsel: return "Ada, parsel ve konum bilgisi sorgulama"
        case .kis: return "Kar küreme ve tuzlama rotaları"
        case .cop: return "Toplama rotaları ve operasyon kayıtları"
        case .temizlik: return "Süpürme ve yıkama güzergahları"
        case .araclar: return "Araçlar, zimmetler ve durum takibi"
        case .bakim: return "Bakım, muayene ve arıza kayıtları"
        case .yakit: return "Araç bazlı tüketim ve dolum kayıtları"
        case .akaryakit: return "Tüketim eğilimleri ve maliyet analizi"
        case .malzemeDepo: return "Stok, hareket ve kritik seviye takibi"
        case .beton: return "Reçete, üretim ve malzeme stokları"
        case .agrega: return "Üretim parametreleri ve maliyet hesabı"
        case .bitum: return "Depo, stok ve bitüm hareketleri"
        case .personel: return "Personel kayıtları ve görev bilgileri"
        case .gunlukCalisma: return "Personel, araç ve mesai kayıtları"
        case .tanimlar: return "Kullanıcılar ve kurumsal tanımlar"
        case .denetim: return "Kullanıcı ve işlem geçmişi"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2.fill"
        case .komuta: return "dot.radiowaves.left.and.right"
        case .raporlar: return "chart.bar"
        case .sikayetler: return "bubble.left.and.bubble.right.fill"
        case .islerim: return "checklist"
        case .whatsapp: return "message"
        case .gorevler: return "list.clipboard.fill"
        case .kontrol: return "checkmark.square"
        case .harita: return "map"
        case .parsel: return "square.split.2x2"
        case .kis: return "snowflake"
        case .cop: return "trash"
        case .temizlik: return "paintbrush"
        case .araclar: return "truck.box.fill"
        case .bakim: return "wrench.and.screwdriver"
        case .yakit: return "fuelpump"
        case .akaryakit: return "chart.line.uptrend.xyaxis"
        case .malzemeDepo: return "shippingbox"
        case .beton: return "square.stack.3d.up"
        case .agrega: return "mountain.2"
        case .bitum: return "drop"
        case .personel: return "person.3"
        case .gunlukCalisma: return "clock"
        case .tanimlar: return "gearshape"
        case .denetim: return "shield.checkered"
        }
    }

    var group: NavGroupId {
        switch self {
        case .dashboard, .komuta, .raporlar: return .operasyon
        case .sikayetler, .islerim, .whatsapp, .gorevler, .kontrol: return .vatandas
        case .harita, .parsel, .kis, .cop, .temizlik: return .saha
        case .araclar, .bakim, .yakit, .akaryakit, .malzemeDepo, .beton, .agrega, .bitum:
            return .filoUretim
        case .personel, .gunlukCalisma, .tanimlar, .denetim: return .kurum
        }
    }
}

struct NavItem: Identifiable, Hashable {
    let destination: NavDestination
    let roles: [UserRole]

    var id: NavDestination { destination }
    var label: String { destination.label }
    var icon: String { destination.icon }
    var group: NavGroupId { destination.group }
}

enum NavItemCatalog {
    private static let allRoles: [UserRole] = UserRole.allCases
    private static let saha: [UserRole] = [.DRIVER, .FIELD_WORKER]

    static let items: [NavItem] = [
        NavItem(destination: .dashboard, roles: allRoles),
        NavItem(destination: .komuta, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .raporlar, roles: [.ADMIN, .DEPARTMENT_MANAGER, .APPROVER]),
        NavItem(destination: .sikayetler, roles: [.ADMIN, .CALL_CENTER, .DEPARTMENT_MANAGER, .APPROVER]),
        NavItem(destination: .islerim, roles: [.ADMIN] + saha),
        NavItem(destination: .whatsapp, roles: [.ADMIN, .CALL_CENTER]),
        NavItem(destination: .gorevler, roles: [.ADMIN, .DEPARTMENT_MANAGER, .APPROVER] + saha),
        NavItem(destination: .kontrol, roles: [.ADMIN, .DEPARTMENT_MANAGER, .APPROVER] + saha),
        NavItem(destination: .harita, roles: allRoles),
        NavItem(destination: .parsel, roles: allRoles),
        NavItem(destination: .kis, roles: allRoles),
        NavItem(destination: .cop, roles: allRoles),
        NavItem(destination: .temizlik, roles: allRoles),
        NavItem(destination: .araclar, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .bakim, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .yakit, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .akaryakit, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .malzemeDepo, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .beton, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .agrega, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .bitum, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .personel, roles: [.ADMIN, .DEPARTMENT_MANAGER]),
        NavItem(destination: .gunlukCalisma, roles: [.ADMIN, .DEPARTMENT_MANAGER] + saha),
        NavItem(destination: .tanimlar, roles: [.ADMIN]),
        NavItem(destination: .denetim, roles: [.ADMIN]),
    ]

    static func items(for role: UserRole, moduleHrefs: [String]? = nil) -> [NavItem] {
        items.filter { item in
            guard item.roles.contains(role) else { return false }
            guard let hrefs = moduleHrefs else { return true }
            return hrefs.contains(item.destination.href)
        }
    }

    static func groupedItems(for role: UserRole, moduleHrefs: [String]? = nil) -> [(group: NavGroupId, items: [NavItem])] {
        let filtered = items(for: role, moduleHrefs: moduleHrefs)
        return NavGroupId.allCases.compactMap { group in
            let groupItems = filtered.filter { $0.group == group }
            guard !groupItems.isEmpty else { return nil }
            return (group, groupItems)
        }
    }

    static func landingDestination(for role: UserRole) -> NavDestination {
        switch role {
        case .CALL_CENTER: return .sikayetler
        case .FIELD_WORKER, .DRIVER: return .islerim
        case .ADMIN, .DEPARTMENT_MANAGER, .APPROVER: return .dashboard
        }
    }

    static func favorites(for role: UserRole) -> [NavDestination] {
        let allowed = Set(items(for: role).map(\.destination))
        let preferred: [NavDestination]
        switch role {
        case .ADMIN:
            preferred = [.dashboard, .sikayetler, .gorevler, .araclar]
        case .CALL_CENTER:
            preferred = [.sikayetler, .whatsapp, .dashboard]
        case .DEPARTMENT_MANAGER:
            preferred = [.dashboard, .sikayetler, .gorevler, .araclar]
        case .APPROVER:
            preferred = [.sikayetler, .gorevler, .raporlar]
        case .DRIVER:
            preferred = [.islerim, .gorevler, .gunlukCalisma]
        case .FIELD_WORKER:
            preferred = [.islerim, .gorevler, .kontrol, .gunlukCalisma]
        }
        return preferred.filter { allowed.contains($0) }
    }

    static func phoneTabs(for role: UserRole) -> (primary: [NavDestination], more: [NavDestination]) {
        let all = items(for: role).map(\.destination)
        let primary = Array(favorites(for: role).prefix(4))
        let more = all.filter { !primary.contains($0) }
        return (primary, more)
    }

    static func label(for destination: NavDestination, role: UserRole) -> String {
        destination.label
    }

    static func shortLabel(for destination: NavDestination, role: UserRole) -> String {
        _ = role
        return destination.shortLabel
    }
}
