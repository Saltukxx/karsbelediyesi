import SwiftUI
import UIKit

struct MainShellView: View {
    @EnvironmentObject private var session: AppSession
    @Environment(\.horizontalSizeClass) private var sizeClass
    @StateObject private var locationService = LocationService.shared

    private var isFieldRole: Bool {
        session.user?.role == .DRIVER || session.user?.role == .FIELD_WORKER
    }

    var body: some View {
        Group {
            if sizeClass == .compact {
                PhoneTabShellView()
            } else {
                PadSplitShellView()
            }
        }
        .tint(KBTheme.navy)
        .environmentObject(locationService)
        .onAppear {
            // Şoför daha önce paylaşımı açtıysa girişte otomatik devam et
            if isFieldRole && locationService.preferenceEnabled {
                locationService.start()
            }
        }
        .onChange(of: session.user?.id) { _, newValue in
            if newValue == nil { locationService.stop() }
        }
    }
}

/// Hesap menüsünde konum paylaşım anahtarı (şoför / saha rolleri)
struct LocationShareMenuItem: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var locationService: LocationService

    private var isFieldRole: Bool {
        session.user?.role == .DRIVER || session.user?.role == .FIELD_WORKER
    }

    var body: some View {
        if isFieldRole {
            Toggle(isOn: Binding(
                get: { locationService.isSharing },
                set: { on in on ? locationService.start() : locationService.stop() }
            )) {
                Label("Konum paylaş", systemImage: "location.fill")
            }
            if locationService.authorizationDenied {
                Text("Konum izni reddedildi — Ayarlar'dan açın")
            }
        }
    }
}

// MARK: - iPhone: Sekmeler + modül menüsü

/// Açık modül. Alt çubukta düğmesi olanlar `sekme`, yalnızca başlıktaki menüden
/// ulaşılanlar `menuden` olur; ikincisinde hiçbir sekme vurgulanmaz.
private enum PhoneTab: Hashable {
    case sekme(NavDestination)
    case menuden(NavDestination)

    var destination: NavDestination {
        switch self {
        case .sekme(let destination), .menuden(let destination): return destination
        }
    }
}

private struct PhoneTabShellView: View {
    @EnvironmentObject private var session: AppSession
    @State private var selectedTab: PhoneTab = .sekme(.dashboard)
    @State private var menuAcik = false

    private var role: UserRole { session.user?.role ?? .ADMIN }

    private var primary: [NavDestination] {
        let tabs = NavItemCatalog.phoneTabs(for: role)
        let allowed = Set(NavItemCatalog.items(for: role, moduleHrefs: session.moduleHrefs).map(\.destination))
        return tabs.primary.filter { allowed.contains($0) }
    }

    var body: some View {
        // Sekme çubuğu safeAreaInset yerine yığının gerçek bir parçası: safeAreaInset
        // güvenli alanı daraltıyor ama çerçeveyi daraltmadığından harita gibi
        // kaydırmayan ekranların alt paneli çubuğun altında kalıyordu.
        VStack(spacing: 0) {
            KBBrandHeader {
                withAnimation(.snappy(duration: 0.25)) { menuAcik = true }
            }
            selectedTabContent
            PhoneFigmaTabBar(
                items: tabBarItems,
                selection: $selectedTab
            )
        }
        .overlay {
            if menuAcik {
                KBModuleDrawer(
                    isPresented: $menuAcik,
                    items: tumModuller,
                    favorites: NavItemCatalog.favorites(for: role).filter(tumModuller.contains),
                    active: aktifModul,
                    onSelect: git
                )
            }
        }
        .onAppear { applyLanding() }
        .onChange(of: session.user?.id) { _, _ in
            menuAcik = false
            applyLanding()
        }
    }

    private var tumModuller: [NavDestination] {
        NavItemCatalog.items(for: role, moduleHrefs: session.moduleHrefs).map(\.destination)
    }

    /// Menüde işaretlenecek modül — sekmeden de menüden de gelinmiş olabilir.
    private var aktifModul: NavDestination? { selectedTab.destination }

    /// Alt çubukta karşılığı olan modüle sekme değiştirerek, diğerlerine menü
    /// yığınının kökünü değiştirerek gidilir.
    private func git(_ destination: NavDestination) {
        selectedTab = primary.contains(destination) ? .sekme(destination) : .menuden(destination)
    }

    private var selectedTabContent: some View {
        // Modül her iki durumda da yığının kökü; `id` kök değişince yığının
        // sıfırlanmasını sağlar, aksi halde önceki modülün detayı açık kalıyor.
        NavigationStack {
            DestinationView(destination: selectedTab.destination)
                .environment(\.kbIsRootScreen, true)
        }
        .id(selectedTab.destination)
    }

    private var tabBarItems: [PhoneTabBarItem] {
        primary.map {
            PhoneTabBarItem(
                tab: .sekme($0),
                title: tabLabel($0),
                icon: tabIcon($0)
            )
        }
    }

    private func tabLabel(_ destination: NavDestination) -> String {
        NavItemCatalog.shortLabel(for: destination, role: role)
    }

    private func tabIcon(_ destination: NavDestination) -> String {
        destination.icon
    }

    private func applyLanding() {
        let landing = NavItemCatalog.landingDestination(for: role)
        if primary.contains(landing) {
            selectedTab = .sekme(landing)
        } else if let ilk = primary.first {
            selectedTab = .sekme(ilk)
        } else {
            selectedTab = .menuden(landing)
        }
    }

}

// MARK: - iPad: Sidebar

private struct PadSplitShellView: View {
    @EnvironmentObject private var session: AppSession
    @State private var selection: NavDestination?

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                BrandMarkView(light: true)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(KBTheme.navyDeep)

                List(selection: $selection) {
                    ForEach(NavItemCatalog.groupedItems(for: session.user?.role ?? .ADMIN, moduleHrefs: session.moduleHrefs), id: \.group) { section in
                        Section(section.group.label) {
                            ForEach(section.items) { item in
                                Label {
                                    Text(NavItemCatalog.label(
                                        for: item.destination,
                                        role: session.user?.role ?? .ADMIN
                                    ))
                                } icon: {
                                    Image(systemName: item.icon)
                                }
                                .tag(Optional(item.destination))
                            }
                        }
                    }
                }
                .listStyle(.sidebar)

                padUserFooter
            }
            .background(KBTheme.background)
        } detail: {
            NavigationStack {
                if let selection {
                    DestinationView(destination: selection)
                } else {
                    ContentUnavailableView("Menüden bir modül seçin", systemImage: "sidebar.left")
                }
            }
        }
        .tint(KBTheme.navy)
        .onAppear {
            if selection == nil, let role = session.user?.role {
                selection = NavItemCatalog.landingDestination(for: role)
            }
        }
        .onChange(of: session.user?.role) { _, role in
            guard let role else { return }
            selection = NavItemCatalog.landingDestination(for: role)
        }
    }

    private var padUserFooter: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()
            if let user = session.user {
                Text(user.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
                Text(user.role.label)
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            }
            LocationShareMenuItem()
                .font(.subheadline)
            Button("Çıkış Yap", role: .destructive) {
                session.signOut()
            }
            .font(.subheadline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(KBTheme.card)
    }
}

private struct PhoneTabBarItem: Identifiable {
    let tab: PhoneTab
    let title: String
    let icon: String

    var id: PhoneTab { tab }
}

private struct PhoneFigmaTabBar: View {
    let items: [PhoneTabBarItem]
    @Binding var selection: PhoneTab

    var body: some View {
        HStack(spacing: 4) {
            ForEach(items) { item in
                let selected = selection == item.tab
                Button {
                    selection = item.tab
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: item.icon)
                            .font(.system(size: 20, weight: selected ? .semibold : .regular))
                            .symbolRenderingMode(.monochrome)
                        Text(item.title)
                            .font(.system(size: 11, weight: selected ? .semibold : .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                    .foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(selected ? KBTheme.action : Color.white.opacity(0.08))
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.title)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(KBTheme.navy.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 0.5)
        }
    }
}
