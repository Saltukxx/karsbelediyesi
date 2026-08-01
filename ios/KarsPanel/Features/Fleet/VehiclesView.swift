import SwiftUI

/// `/araclar` — araç envanteri listesi.
struct VehiclesView: View {
    @StateObject private var viewModel = VehiclesViewModel()
    @EnvironmentObject private var session: AppSession
    @State private var yeniAracGosteriliyor = false

    private var canEdit: Bool {
        session.role == .ADMIN || session.role == .DEPARTMENT_MANAGER
    }

    var body: some View {
        KBModuleScreen(
            title: NavDestination.araclar.label,
            icon: NavDestination.araclar.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.rows.isEmpty,
            emptyMessage: "Envanterde araç yok. Sağ üstten yeni araç ekleyebilirsiniz.",
            searchText: $viewModel.searchText,
            searchPrompt: "Plaka, marka veya model",
            newItemLabel: canEdit ? "Yeni Araç" : nil,
            onNewItem: canEdit ? { yeniAracGosteriliyor = true } : nil,
            onRefresh: { await viewModel.load() }
        ) {
            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    .listRowBackground(Color.clear)
            }

            Section {
                Picker("Envanter durumu", selection: $viewModel.envanterFiltre) {
                    Text("Tümü").tag(VehicleInventoryStatus?.none)
                    ForEach(VehicleInventoryStatus.allCases) { durum in
                        Text(durum.displayName).tag(Optional(durum))
                    }
                }
                .pickerStyle(.menu)
            }

            Section("Araçlar (\(viewModel.total))") {
                ForEach(viewModel.rows) { row in
                    NavigationLink(value: PanelRoute.vehicle(row.id)) {
                        KBListRow(
                            title: row.plaka,
                            subtitle: row.altBaslik,
                            detail: satirDetay(row),
                            badge: VehicleInventoryStatus(rawValue: row.envanterDurumu)?
                                .displayName ?? row.envanterDurumu,
                            badgeTone: (VehicleInventoryStatus(rawValue: row.envanterDurumu)?
                                .badgeTone ?? .neutral).badge,
                            trailingValue: sayacMetni(row)
                        )
                    }
                    .task { await viewModel.loadMoreIfNeeded(current: row) }
                }
                if viewModel.isLoadingMore {
                    HStack { Spacer(); ProgressView(); Spacer() }
                }
            }
        }
        .onChange(of: viewModel.searchText) { _, _ in viewModel.searchChanged() }
        .onChange(of: viewModel.envanterFiltre) { _, _ in Task { await viewModel.load() } }
        .task { if viewModel.rows.isEmpty { await viewModel.load() } }
        .sheet(isPresented: $yeniAracGosteriliyor) {
            NavigationStack {
                VehicleFormView(mode: .create) { Task { await viewModel.load() } }
            }
        }
    }

    private func satirDetay(_ row: VehicleListItemDTO) -> String? {
        var parts: [String] = []
        if let mudurluk = row.mudurluk { parts.append(mudurluk) }
        if let sofor = row.atananSoforAdi { parts.append("Şoför: \(sofor)") }
        if let operasyon = VehicleOperationStatus(rawValue: row.operasyonDurumu) {
            parts.append(operasyon.displayName)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func sayacMetni(_ row: VehicleListItemDTO) -> String? {
        guard let deger = row.sayacDeger else { return nil }
        let birim = MeterUnit(rawValue: row.sayacBirim ?? "KM") == .SAAT ? "sa" : "km"
        return KBNumberFormat.miktar(deger, birim: birim)
    }
}

/// `/araclar/[id]` — araç kartı: künye, bakım, yakıt, görev ve mesai geçmişi.
struct VehicleDetailView: View {
    @StateObject private var viewModel: VehicleDetailViewModel
    @EnvironmentObject private var session: AppSession
    @State private var duzenleGosteriliyor = false

    init(vehicleId: String) {
        _viewModel = StateObject(wrappedValue: VehicleDetailViewModel(vehicleId: vehicleId))
    }

    private var canEdit: Bool {
        session.role == .ADMIN || session.role == .DEPARTMENT_MANAGER
    }

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if let card = viewModel.card {
                kunye(card.arac)
                bakimlar(card.bakimlar)
                yakitlar(card.yakitlar)
                gorevler(card.gorevler)
                mesailer(card.gunlukCalismalar)
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(viewModel.card?.arac.plaka ?? "Araç")
        .toolbar {
            if canEdit, viewModel.card != nil {
                ToolbarItem(placement: .primaryAction) {
                    Button("Düzenle") { duzenleGosteriliyor = true }
                }
            }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading, viewModel.card == nil { LoadingOverlay() } }
        .sheet(isPresented: $duzenleGosteriliyor) {
            if let arac = viewModel.card?.arac {
                NavigationStack {
                    VehicleFormView(mode: .edit(arac)) { Task { await viewModel.load() } }
                }
            }
        }
    }

    @ViewBuilder
    private func kunye(_ arac: VehicleDetailDTO) -> some View {
        Section("Künye") {
            KBDetailRow(label: "Plaka", value: arac.plaka)
            KBDetailRow(label: "Ad", value: arac.ad)
            KBDetailRow(label: "Cins", value: arac.cins)
            KBDetailRow(label: "Marka / Model", value: [arac.marka, arac.model]
                .compactMap { $0 }.joined(separator: " "))
            KBDetailRow(label: "Model yılı", value: arac.modelYili.map(String.init))
            KBDetailRow(label: "Müdürlük", value: arac.mudurluk)
            KBDetailRow(label: "Şoför", value: arac.atananSoforAdi)
            KBDetailRow(
                label: "Envanter",
                value: VehicleInventoryStatus(rawValue: arac.envanterDurumu)?.displayName
                    ?? arac.envanterDurumu
            )
            KBDetailRow(
                label: "Operasyon",
                value: VehicleOperationStatus(rawValue: arac.operasyonDurumu)?.displayName
                    ?? arac.operasyonDurumu
            )
        }

        Section("Teknik") {
            KBDetailRow(
                label: "Yakıt tipi",
                value: arac.yakitTipi.flatMap { VehicleFuelType(rawValue: $0)?.displayName }
            )
            KBDetailRow(label: "Kapasite", value: arac.kapasite)
            KBDetailRow(
                label: "Sayaç",
                value: KBNumberFormat.miktar(
                    arac.sayacDeger,
                    birim: MeterUnit(rawValue: arac.sayacBirim ?? "KM") == .SAAT ? "saat" : "km"
                )
            )
            KBDetailRow(label: "Norm tüketim", value: KBNumberFormat.miktar(arac.normTuketim))
            KBDetailRow(label: "Bakım km/saat", value: arac.bakimKmSaati)
        }

        Section("Takvim") {
            KBDetailRow(label: "Muayene", value: arac.muayeneTarihi.kbGun)
            KBDetailRow(label: "Sigorta bitiş", value: arac.sigortaBitis.kbGun)
            KBDetailRow(label: "Son bakım", value: arac.sonBakimTarihi.kbGun)
            KBDetailRow(label: "Sonraki bakım", value: arac.sonrakiBakimTarihi.kbGun)
        }

        if let notlar = arac.notlar, !notlar.isEmpty {
            Section("Notlar") { Text(notlar).font(.subheadline) }
        }
    }

    @ViewBuilder
    private func bakimlar(_ rows: [MaintenanceSummaryDTO]) -> some View {
        Section("Bakım geçmişi") {
            if rows.isEmpty {
                Text("Kayıt yok").font(.subheadline).foregroundStyle(KBTheme.muted)
            } else {
                ForEach(rows) { row in
                    KBListRow(
                        title: MaintenanceKind(rawValue: row.bakimTuru)?.displayName
                            ?? row.bakimTuru,
                        subtitle: row.bakimTarihi.kbGun,
                        detail: row.yapilanIslemler,
                        badge: MaintenanceStatus(rawValue: row.durum)?.displayName ?? row.durum,
                        badgeTone: (MaintenanceStatus(rawValue: row.durum)?.badgeTone ?? .neutral)
                            .badge,
                        trailingValue: KBNumberFormat.para(row.maliyet)
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func yakitlar(_ rows: [FuelSummaryDTO]) -> some View {
        Section("Yakıt alımları") {
            if rows.isEmpty {
                Text("Kayıt yok").font(.subheadline).foregroundStyle(KBTheme.muted)
            } else {
                ForEach(rows) { row in
                    KBListRow(
                        title: FuelKind(rawValue: row.yakitTuru)?.displayName ?? row.yakitTuru,
                        subtitle: row.tarih.kbGun,
                        detail: KBNumberFormat.miktar(row.litre, birim: "lt"),
                        trailingValue: KBNumberFormat.para(row.tutar)
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func gorevler(_ rows: [VehicleTaskBriefDTO]) -> some View {
        Section("Görevler") {
            if rows.isEmpty {
                Text("Kayıt yok").font(.subheadline).foregroundStyle(KBTheme.muted)
            } else {
                ForEach(rows) { row in
                    KBListRow(
                        title: row.gorevNo,
                        subtitle: row.gorevTanimi,
                        detail: (row.cikisTarihi ?? row.talepTarihi).kbGun,
                        badge: row.durum
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func mesailer(_ rows: [VehicleWorkLogBriefDTO]) -> some View {
        Section("Günlük çalışma") {
            if rows.isEmpty {
                Text("Kayıt yok").font(.subheadline).foregroundStyle(KBTheme.muted)
            } else {
                ForEach(rows) { row in
                    KBListRow(
                        title: row.tarih.kbGun,
                        subtitle: row.soforAdi,
                        detail: "\(row.girisSaati) – \(row.cikisSaati)",
                        trailingValue: KBNumberFormat.miktar(row.calismaSaati, birim: "sa")
                    )
                }
            }
        }
    }
}
