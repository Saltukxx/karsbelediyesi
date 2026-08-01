import SwiftUI

/// `/komuta` — canlı operasyon görünümü. 30 saniyede bir yenilenir, uygulama
/// arka plana geçtiğinde durur. iPad'de "TV modu" haritayı tam ekrana alır.
struct KomutaView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var navigator: AppNavigator
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.horizontalSizeClass) private var sizeClass
    @StateObject private var viewModel = KomutaViewModel()
    @State private var basemap: KBMapBasemap = .uydu
    @State private var tvModu = false

    var body: some View {
        Group {
            if tvModu {
                tvGorunumu
            } else {
                panelGorunumu
            }
        }
        .navigationTitle(NavDestination.komuta.label)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(tvModu ? .hidden : .visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .primaryAction) { araclarMenusu }
        }
        .overlay {
            if viewModel.isLoading, viewModel.veri == nil { LoadingOverlay() }
        }
        .task { await viewModel.load() }
        .onAppear { viewModel.pollingBaslat(phase: .active) }
        .onDisappear { viewModel.pollingDurdur() }
        .onChange(of: scenePhase) { _, yeni in
            viewModel.pollingBaslat(phase: KBAppPhase(yeni))
        }
    }

    // MARK: - Panel görünümü

    private var panelGorunumu: some View {
        List {
            Section {
                durumSatiri
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 4, trailing: 12))
            }

            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            Section {
                KBStatRow(tiles: viewModel.kpiKartlari)
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
            }

            Section {
                harita(yukseklik: 320)
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                KBMapBasemapPicker(basemap: $basemap)
            }

            gecikenIslerBolumu
            bekleyenAtamalarBolumu
            filoBolumu
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .refreshable { await viewModel.load() }
    }

    /// iPad'de duvara asılan ekran için: harita tam alanı kaplar, yanında
    /// yalnızca geciken işler ve bekleyen atamalar durur.
    private var tvGorunumu: some View {
        VStack(spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(NavDestination.komuta.label)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(KBTheme.navy)
                    durumSatiri
                }
                Spacer()
                Button {
                    tvModu = false
                } label: {
                    Label("TV modundan çık", systemImage: "arrow.down.right.and.arrow.up.left")
                }
                .buttonStyle(KBChipButtonStyle(tone: .neutral))
            }

            KBStatRow(tiles: viewModel.kpiKartlari)

            HStack(alignment: .top, spacing: 12) {
                harita(yukseklik: nil)
                    .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))

                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        tvKart("Geciken işler (\(viewModel.gecikenIsSayisi))") {
                            gecikenIcerik
                        }
                        tvKart("Bekleyen atamalar (\(viewModel.bekleyenler.count))") {
                            bekleyenIcerik
                        }
                    }
                }
                .frame(width: 340)
            }
        }
        .padding(16)
        .kbScreenBackground()
    }

    @ViewBuilder
    private func tvKart(
        _ baslik: String,
        @ViewBuilder icerik: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeaderLabel(title: baslik)
            icerik()
        }
        .kbCard()
    }

    // MARK: - Ortak parçalar

    private var durumSatiri: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(viewModel.canliMi ? KBTheme.success : KBTheme.muted)
                .frame(width: 8, height: 8)
            Text(viewModel.durumMetni)
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
            Spacer(minLength: 0)
        }
        .accessibilityLabel("Canlı veri durumu: \(viewModel.durumMetni)")
    }

    private var araclarMenusu: some View {
        Menu {
            Button {
                Task { await viewModel.load() }
            } label: {
                Label("Şimdi yenile", systemImage: "arrow.clockwise")
            }
            Button {
                Task { await viewModel.slaTaramasi() }
            } label: {
                Label("SLA taraması çalıştır", systemImage: "bell.badge")
            }
            if sizeClass == .regular {
                Button {
                    tvModu = true
                } label: {
                    Label("TV modu", systemImage: "arrow.up.left.and.arrow.down.right")
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
        }
        .accessibilityLabel("Komuta işlemleri")
    }

    private func harita(yukseklik: CGFloat?) -> some View {
        KBMapView(
            polylines: viewModel.polylines,
            pins: viewModel.pins,
            basemap: basemap,
            showsUserLocation: false,
            onSelectPin: { viewModel.pinSecildi($0) },
            focusKey: viewModel.kadrajAnahtari,
            focus: viewModel.odak
        )
        .frame(height: yukseklik)
        .frame(maxWidth: .infinity, maxHeight: yukseklik == nil ? .infinity : nil)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
    }

    @ViewBuilder
    private var gecikenIslerBolumu: some View {
        Section("Geciken işler (\(viewModel.gecikenIsSayisi))") {
            gecikenIcerik
        }
    }

    @ViewBuilder
    private var gecikenIcerik: some View {
        if viewModel.gecikenIsSayisi == 0 {
            Text("Geciken iş yok.")
                .font(.caption)
                .foregroundStyle(KBTheme.success)
        }
        ForEach(viewModel.gecikenRotalar) { rota in
            Button {
                viewModel.rotayaOdakla(rota)
            } label: {
                KBListRow(
                    title: "\(rota.tip.displayName) · \(rota.ad)",
                    subtitle: rota.gecikmeMetni,
                    detail: rota.sonIslem.map { "Son işlem \($0.kbAn)" },
                    badge: "Gecikmiş",
                    badgeTone: .danger
                )
            }
            .buttonStyle(.plain)
        }
        ForEach(viewModel.gecikenSikayetler) { sikayet in
            Button {
                viewModel.noktayaOdakla(sikayet.koordinat)
            } label: {
                KBListRow(
                    title: sikayet.sikayetNo,
                    subtitle: sikayet.aciklama,
                    detail: "Kayıt \(sikayet.kayitTarihi.kbAn)",
                    badge: sikayet.bucket.displayName,
                    badgeTone: sikayet.bucket.badgeTone.badge
                )
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var bekleyenAtamalarBolumu: some View {
        Section("Bekleyen atamalar (\(viewModel.bekleyenler.count))") {
            bekleyenIcerik
        }
    }

    @ViewBuilder
    private var bekleyenIcerik: some View {
        if viewModel.bekleyenler.isEmpty {
            Text("Bekleyen sevkiyat önerisi yok.")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
        }
        ForEach(viewModel.bekleyenler) { oneri in
            VStack(alignment: .leading, spacing: 6) {
                KBListRow(
                    title: "\(oneri.tip.displayName) · \(oneri.routeAd)",
                    subtitle: oneri.aracMetni,
                    detail: oneri.gerekceOzet,
                    badge: oneri.createdAt.kbSaat,
                    badgeTone: .warning
                )
                if session.canManageOperations {
                    HStack(spacing: 8) {
                        Button("Ata") { Task { await viewModel.ata(oneri) } }
                            .buttonStyle(KBChipButtonStyle(tone: .success))
                        Button("Reddet") { Task { await viewModel.reddet(oneri) } }
                            .buttonStyle(KBChipButtonStyle(tone: .danger))
                    }
                    .disabled(viewModel.islemYapiliyor)
                }
            }
        }
    }

    @ViewBuilder
    private var filoBolumu: some View {
        Section("Filo (\(viewModel.araclar.count))") {
            HStack(spacing: 10) {
                KBStatTile(
                    label: "Görevde",
                    value: String(viewModel.filo.gorevde),
                    tone: .info
                )
                KBStatTile(
                    label: "Boşta",
                    value: String(viewModel.filo.bosta),
                    tone: .success
                )
                KBStatTile(
                    label: "Konumsuz",
                    value: String(viewModel.filo.konumsuz),
                    tone: .neutral
                )
            }
            .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))

            ForEach(viewModel.konumluAraclar) { arac in
                Button {
                    if let koordinat = arac.koordinat { viewModel.noktayaOdakla(koordinat) }
                } label: {
                    KBListRow(
                        title: arac.plaka,
                        subtitle: [arac.tip, arac.aktifGorev?.gorevNo ?? "boşta"]
                            .compactMap { $0 }
                            .joined(separator: " · "),
                        detail: arac.konumZamani.map { "Son konum \($0.kbAn)" },
                        badge: arac.rotaDurumu ?? (arac.taze ? "canlı" : "bayat"),
                        badgeTone: viewModel.aracTonu(arac)
                    )
                }
                .buttonStyle(.plain)
            }

            Button {
                navigator.ac(KBDeepLink(destination: .araclar))
            } label: {
                Label("Araç envanterine git", systemImage: "arrow.right.circle")
                    .font(.caption.weight(.semibold))
            }
        }
    }
}
