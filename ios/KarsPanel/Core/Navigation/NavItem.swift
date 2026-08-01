import Foundation

enum NavGroupId: String, CaseIterable {
    case genel
    case cagri
    case filo
    case uretim
    case insan
    case yonetim

    var label: String {
        switch self {
        case .genel: return "Genel"
        case .cagri: return "Çağrı / İş"
        case .filo: return "Filo"
        case .uretim: return "Üretim / Depo"
        case .insan: return "İnsan / Mesai"
        case .yonetim: return "Yönetim"
        }
    }
}

enum NavDestination: String, Hashable, CaseIterable {
    case dashboard
    case komuta
    case raporlar
    case harita
    case parsel
    case kis
    case cop
    case temizlik
    case sikayetler
    case islerim
    case whatsapp
    case gorevler
    case kontrol
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

    var label: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .komuta: return "Komuta Ekranı"
        case .raporlar: return "Raporlar"
        case .harita: return "Yol Haritası"
        case .parsel: return "Parsel Sorgu"
        case .kis: return "Kış Operasyonu"
        case .cop: return "Çöp Toplama"
        case .temizlik: return "Yol Temizliği"
        case .sikayetler: return "Şikayet Kayıt & Takip"
        case .islerim: return "İşlerim"
        case .whatsapp: return "WhatsApp Kuyruğu"
        case .gorevler: return "Görevlendirme"
        case .kontrol: return "Kontrol Listeleri"
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

    /// Tab bar / dar alan için kısa etiket
    var shortLabel: String {
        switch self {
        case .dashboard: return "Özet"
        case .komuta: return "Komuta"
        case .raporlar: return "Rapor"
        case .harita: return "Harita"
        case .parsel: return "Parsel"
        case .kis: return "Kış"
        case .cop: return "Çöp"
        case .temizlik: return "Temizlik"
        case .sikayetler: return "Şikayet"
        case .islerim: return "İşlerim"
        case .whatsapp: return "WhatsApp"
        case .gorevler: return "Görev"
        case .kontrol: return "Kontrol"
        case .araclar: return "Araç"
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

    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .komuta: return "dot.radiowaves.left.and.right"
        case .raporlar: return "chart.bar"
        case .harita: return "map"
        case .parsel: return "square.dashed"
        case .kis: return "snowflake"
        case .cop: return "trash"
        case .temizlik: return "paintbrush"
        case .sikayetler: return "phone"
        case .islerim: return "list.bullet.clipboard"
        case .whatsapp: return "message"
        case .gorevler: return "list.clipboard"
        case .kontrol: return "checkmark.square"
        case .araclar: return "truck.box"
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
        case .denetim: return "checkmark.shield"
        }
    }

    var group: NavGroupId {
        switch self {
        case .dashboard, .komuta, .raporlar, .harita, .parsel, .kis, .cop, .temizlik:
            return .genel
        case .sikayetler, .islerim, .whatsapp, .gorevler, .kontrol: return .cagri
        case .araclar, .bakim, .yakit, .akaryakit: return .filo
        case .malzemeDepo, .beton, .agrega, .bitum: return .uretim
        case .personel, .gunlukCalisma: return .insan
        case .tanimlar, .denetim: return .yonetim
        }
    }

    /// Web panelindeki karşılık gelen yol. Rol matrisi parite testi bu eşleme
    /// üzerinden web `NAV_ITEMS` ile karşılaştırma yapar.
    var webPath: String {
        switch self {
        case .dashboard: return "/"
        case .komuta: return "/komuta"
        case .raporlar: return "/raporlar"
        case .harita: return "/harita"
        case .parsel: return "/parsel"
        case .kis: return "/kis"
        case .cop: return "/cop"
        case .temizlik: return "/temizlik"
        case .sikayetler: return "/sikayetler"
        case .islerim: return "/islerim"
        case .whatsapp: return "/whatsapp"
        case .gorevler: return "/gorevler"
        case .kontrol: return "/kontrol-listeleri"
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
        NavItem(destination: .harita, roles: allRoles),
        NavItem(destination: .parsel, roles: allRoles),
        NavItem(destination: .kis, roles: allRoles),
        NavItem(destination: .cop, roles: allRoles),
        NavItem(destination: .temizlik, roles: allRoles),
        NavItem(destination: .sikayetler, roles: [.ADMIN, .CALL_CENTER, .DEPARTMENT_MANAGER, .APPROVER]),
        NavItem(destination: .islerim, roles: [.ADMIN] + saha),
        NavItem(destination: .whatsapp, roles: [.ADMIN, .CALL_CENTER]),
        NavItem(destination: .gorevler, roles: [.ADMIN, .DEPARTMENT_MANAGER, .APPROVER] + saha),
        NavItem(destination: .kontrol, roles: [.ADMIN, .DEPARTMENT_MANAGER, .APPROVER] + saha),
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

    static func items(for role: UserRole) -> [NavItem] {
        items.filter { $0.roles.contains(role) }
    }

    static func groupedItems(for role: UserRole) -> [(group: NavGroupId, items: [NavItem])] {
        let filtered = items(for: role)
        return NavGroupId.allCases.compactMap { group in
            let groupItems = filtered.filter { $0.group == group }
            guard !groupItems.isEmpty else { return nil }
            return (group, groupItems)
        }
    }

    /// Web `landingPathForRole` ile aynı: saha personeli doğrudan İşlerim'e düşer,
    /// şoför araç görevlerini dashboard'da görür.
    static func landingDestination(for role: UserRole) -> NavDestination {
        switch role {
        case .CALL_CENTER: return .sikayetler
        case .FIELD_WORKER: return .islerim
        case .ADMIN, .DEPARTMENT_MANAGER, .APPROVER, .DRIVER: return .dashboard
        }
    }

    /// Web `favoritesForRole` ile uyumlu sık kullanılanlar (max 4 tab)
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

    /// iPhone tab bar: favoriler + gerekirse Daha Fazla
    static func phoneTabs(for role: UserRole) -> (primary: [NavDestination], more: [NavDestination]) {
        let all = items(for: role).map(\.destination)
        let fav = favorites(for: role)
        let primary = Array(fav.prefix(4))
        let more = all.filter { !primary.contains($0) }
        return (primary, more)
    }
}
