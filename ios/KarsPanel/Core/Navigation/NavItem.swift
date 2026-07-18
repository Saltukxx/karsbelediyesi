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
    case raporlar
    case sikayetler
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

    var label: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .raporlar: return "Raporlar"
        case .sikayetler: return "Şikayet Kayıt & Takip"
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
        }
    }

    /// Tab bar / dar alan için kısa etiket
    var shortLabel: String {
        switch self {
        case .dashboard: return "Özet"
        case .raporlar: return "Rapor"
        case .sikayetler: return "Şikayet"
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
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .raporlar: return "chart.bar"
        case .sikayetler: return "phone"
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
        }
    }

    var group: NavGroupId {
        switch self {
        case .dashboard, .raporlar: return .genel
        case .sikayetler, .whatsapp, .gorevler, .kontrol: return .cagri
        case .araclar, .bakim, .yakit, .akaryakit: return .filo
        case .malzemeDepo, .beton, .agrega, .bitum: return .uretim
        case .personel, .gunlukCalisma: return .insan
        case .tanimlar: return .yonetim
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
        NavItem(destination: .raporlar, roles: [.ADMIN, .DEPARTMENT_MANAGER, .APPROVER]),
        NavItem(destination: .sikayetler, roles: [.ADMIN, .CALL_CENTER, .DEPARTMENT_MANAGER, .APPROVER]),
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
    ]

    static func items(for role: UserRole) -> [NavItem] {
        items.filter { $0.roles.contains(role) }.map { item in
            guard item.destination == .dashboard,
                  role == .DRIVER || role == .FIELD_WORKER else { return item }
            return NavItem(destination: .dashboard, roles: item.roles)
        }
    }

    static func label(for destination: NavDestination, role: UserRole) -> String {
        if destination == .dashboard, role == .DRIVER || role == .FIELD_WORKER {
            return "İşlerim"
        }
        return destination.label
    }

    static func groupedItems(for role: UserRole) -> [(group: NavGroupId, items: [NavItem])] {
        let filtered = items(for: role)
        return NavGroupId.allCases.compactMap { group in
            let groupItems = filtered.filter { $0.group == group }
            guard !groupItems.isEmpty else { return nil }
            return (group, groupItems)
        }
    }

    static func landingDestination(for role: UserRole) -> NavDestination {
        switch role {
        case .CALL_CENTER: return .sikayetler
        default: return .dashboard
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
            preferred = [.dashboard, .gorevler, .gunlukCalisma]
        case .FIELD_WORKER:
            preferred = [.dashboard, .gorevler, .kontrol, .gunlukCalisma]
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

    static func shortLabel(for destination: NavDestination, role: UserRole) -> String {
        if destination == .dashboard, role == .DRIVER || role == .FIELD_WORKER {
            return "İşlerim"
        }
        return destination.shortLabel
    }
}
