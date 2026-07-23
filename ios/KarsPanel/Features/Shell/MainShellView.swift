import SwiftUI

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

// MARK: - iPhone: Tab + Daha Fazla

private enum PhoneTab: Hashable {
    case module(NavDestination)
    case more
}

private struct PhoneTabShellView: View {
    @EnvironmentObject private var session: AppSession
    @State private var selectedTab: PhoneTab = .more
    @State private var morePath = NavigationPath()

    private var role: UserRole { session.user?.role ?? .ADMIN }

    private var primary: [NavDestination] {
        NavItemCatalog.phoneTabs(for: role).primary
    }

    private var moreItems: [NavDestination] {
        NavItemCatalog.phoneTabs(for: role).more
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(primary, id: \.self) { destination in
                NavigationStack {
                    DestinationView(destination: destination)
                        .toolbar { accountMenu }
                }
                .tabItem {
                    Label(
                        NavItemCatalog.shortLabel(for: destination, role: role),
                        systemImage: destination.icon
                    )
                }
                .tag(PhoneTab.module(destination))
            }

            if !moreItems.isEmpty {
                NavigationStack(path: $morePath) {
                    MoreModulesView(moreItems: moreItems) { destination in
                        morePath.append(destination)
                    }
                    .toolbar { accountMenu }
                    .navigationDestination(for: NavDestination.self) { destination in
                        DestinationView(destination: destination)
                    }
                }
                .tabItem {
                    Label("Daha Fazla", systemImage: "ellipsis.circle")
                }
                .tag(PhoneTab.more)
            }
        }
        .onAppear { applyLanding() }
        .onChange(of: session.user?.id) { _, _ in
            morePath = NavigationPath()
            applyLanding()
        }
    }

    private func applyLanding() {
        let landing = NavItemCatalog.landingDestination(for: role)
        if primary.contains(landing) {
            selectedTab = .module(landing)
        } else {
            selectedTab = moreItems.isEmpty ? .module(primary.first ?? .dashboard) : .more
        }
    }

    @ToolbarContentBuilder
    private var accountMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                if let user = session.user {
                    Text(user.name)
                    Text(user.role.label)
                    Divider()
                }
                LocationShareMenuItem()
                Button("Çıkış Yap", role: .destructive) {
                    session.signOut()
                }
            } label: {
                Image(systemName: "person.crop.circle.fill")
                    .symbolRenderingMode(.hierarchical)
                    .font(.title3)
                    .foregroundStyle(KBTheme.navy)
                    .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
            }
            .accessibilityLabel("Hesap menüsü")
        }
    }
}

private struct MoreModulesView: View {
    @EnvironmentObject private var session: AppSession
    let moreItems: [NavDestination]
    var onSelect: (NavDestination) -> Void

    private var role: UserRole { session.user?.role ?? .ADMIN }

    var body: some View {
        List {
            ForEach(NavGroupId.allCases, id: \.self) { group in
                let items = moreItems.filter { $0.group == group }
                if !items.isEmpty {
                    Section(group.label) {
                        ForEach(items, id: \.self) { destination in
                            Button {
                                onSelect(destination)
                            } label: {
                                HStack(spacing: 14) {
                                    Image(systemName: destination.icon)
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(KBTheme.accent)
                                        .frame(width: 28)
                                    Text(NavItemCatalog.label(for: destination, role: role))
                                        .foregroundStyle(KBTheme.navy)
                                        .multilineTextAlignment(.leading)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(KBTheme.muted)
                                }
                                .padding(.vertical, 4)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle("Modüller")
        .navigationBarTitleDisplayMode(.large)
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
                    ForEach(NavItemCatalog.groupedItems(for: session.user?.role ?? .ADMIN), id: \.group) { section in
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
