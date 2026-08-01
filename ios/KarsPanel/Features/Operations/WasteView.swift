import SwiftUI

/// `/cop` — çöp toplama rotaları, haftalık toplama günleri ve geçiş kayıtları.
struct WasteView: View {
    @StateObject private var viewModel = WasteViewModel()
    @ObservedObject private var lookups = LookupStore.shared
    @State private var basemap: KBMapBasemap = .standart
    @State private var rotaFormu = false
    @State private var toplamaRotasi: WasteRouteDTO?
    @State private var atamaHedefi: SmartAssignTarget?

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
            }

            Section {
                RouteOverviewMap(
                    polylines: viewModel.polylines,
                    basemap: $basemap,
                    focusKey: viewModel.kadrajAnahtari
                )
                .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
            }

            Section("Bugün toplanacak (\(viewModel.bugunkuRotalar.count))") {
                if viewModel.bugunkuRotalar.isEmpty {
                    Text("Bugün için planlanmış rota yok")
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
                ForEach(viewModel.bugunkuRotalar) { rota in
                    KBListRow(
                        title: rota.ad,
                        subtitle: rota.gunEtiketi,
                        detail: rota.sonToplama.map { "Son toplama: \($0.kbAn)" },
                        badge: rota.oncelikEtiketi,
                        badgeTone: rota.oncelikTonu.badge
                    )
                }
            }

            Section("Rotalar (\(viewModel.rotalar.count))") {
                if viewModel.rotalar.isEmpty {
                    Text("Tanımlı çöp rotası yok")
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
                ForEach(viewModel.rotalar) { rota in
                    VStack(alignment: .leading, spacing: 8) {
                        RouteSummaryRow(
                            rota: rota,
                            detay: [
                                "Günler: \(rota.gunEtiketi)",
                                rota.sonToplama.map { "Son toplama: \($0.kbAn)" },
                            ]
                            .compactMap { $0 }
                            .joined(separator: " · ")
                        )

                        ForEach(rota.sonToplamalar.prefix(3)) { toplama in
                            WasteCollectionRow(
                                toplama: toplama,
                                silinebilir: viewModel.duzenleyebilir,
                                onSil: { Task { await viewModel.toplamaSil(toplama) } }
                            )
                        }

                        if viewModel.duzenleyebilir {
                            HStack(spacing: 8) {
                                Button("Toplama Kaydet") { toplamaRotasi = rota }
                                    .buttonStyle(KBChipButtonStyle(tone: .info))
                                Button("Araç Ata") {
                                    atamaHedefi = SmartAssignTarget(
                                        tip: .COP,
                                        routeId: rota.id,
                                        routeAd: rota.ad
                                    )
                                }
                                .buttonStyle(KBChipButtonStyle(tone: .success))
                                Button(rota.aktif ? "Pasife Al" : "Aktifleştir") {
                                    Task { await viewModel.aktiflikDegistir(rota) }
                                }
                                .buttonStyle(KBChipButtonStyle(tone: .warning))
                                Button("Sil", role: .destructive) {
                                    Task { await viewModel.rotaSil(rota) }
                                }
                                .buttonStyle(KBChipButtonStyle(tone: .danger))
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(NavDestination.cop.label)
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await viewModel.load() }
        .toolbar {
            if viewModel.duzenleyebilir {
                ToolbarItem(placement: .primaryAction) {
                    Button { rotaFormu = true } label: {
                        Label("Yeni Rota", systemImage: "plus")
                    }
                }
            }
        }
        .overlay {
            if viewModel.isLoading, viewModel.rotalar.isEmpty { LoadingOverlay() }
        }
        .task {
            if viewModel.veri == nil { await viewModel.load() }
            await lookups.loadIfNeeded()
        }
        .sheet(isPresented: $rotaFormu) {
            NavigationStack {
                WasteRouteFormView { Task { await viewModel.load() } }
            }
        }
        .sheet(item: $toplamaRotasi) { rota in
            NavigationStack {
                WasteCollectionFormView(rota: rota, lookups: lookups) {
                    Task { await viewModel.load() }
                }
            }
        }
        .smartAssignSheet($atamaHedefi) { Task { await viewModel.load() } }
    }
}

private struct WasteCollectionRow: View {
    let toplama: WasteCollectionDTO
    let silinebilir: Bool
    let onSil: () -> Void

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(toplama.baslangic.kbAn)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
                Text(
                    [toplama.plaka, toplama.soforAdi, toplama.notlar]
                        .compactMap { $0 }
                        .joined(separator: " · ")
                )
                .font(.caption2)
                .foregroundStyle(KBTheme.muted)
            }
            Spacer(minLength: 8)
            if silinebilir {
                Button("Sil", role: .destructive, action: onSil)
                    .buttonStyle(KBChipButtonStyle(tone: .danger))
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
final class WasteViewModel: ObservableObject {
    @Published private(set) var veri: WasteOverviewDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var rotalar: [WasteRouteDTO] { veri?.rotalar ?? [] }
    var duzenleyebilir: Bool { veri?.duzenleyebilir ?? false }

    /// Web'deki "bugün toplanacak" listesi: ISO gün numarası eşleşen aktif rotalar.
    var bugunkuRotalar: [WasteRouteDTO] {
        let bugun = WeekDay.isoGun(Date())
        return rotalar.filter { $0.aktif && $0.gunler.contains(bugun) }
    }

    var ozet: [KBStat] {
        [
            KBStat(
                label: "Aktif rota",
                value: "\(rotalar.filter(\.aktif).count) / \(rotalar.count)",
                tone: .info
            ),
            KBStat(label: "Bugün", value: String(bugunkuRotalar.count), tone: .accent),
            KBStat(
                label: "Son toplamalar",
                value: String(rotalar.flatMap(\.sonToplamalar).count),
                tone: .success
            ),
        ]
    }

    var polylines: [KBMapPolyline] {
        rotalar.map { rota in
            KBMapPolyline(
                id: rota.id,
                coordinates: KBGeo.coordinates(rota.koordinatlar),
                style: rota.aktif ? .cop : .pasif
            )
        }
    }

    var kadrajAnahtari: String { "cop-\(rotalar.count)" }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            veri = try await api.fetchWasteOverview()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func aktiflikDegistir(_ rota: WasteRouteDTO) async {
        await calistir {
            _ = try await self.api.updateWasteRoute(
                id: rota.id,
                body: OperationRoutePatchDTO(aktif: !rota.aktif)
            )
        }
    }

    func rotaSil(_ rota: WasteRouteDTO) async {
        await calistir { _ = try await self.api.deleteWasteRoute(id: rota.id) }
    }

    func toplamaSil(_ toplama: WasteCollectionDTO) async {
        await calistir { _ = try await self.api.deleteWasteCollection(id: toplama.id) }
    }

    private func calistir(_ islem: @escaping () async throws -> Void) async {
        errorMessage = nil
        do {
            try await islem()
        } catch {
            errorMessage = APIError.describe(error)
        }
        await load()
    }
}

// MARK: - Rota formu

struct WasteRouteFormView: View {
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = WasteRouteFormModel()
    @State private var basemap: KBMapBasemap = .standart
    @State private var seciliNokta: Int?

    var body: some View {
        Form {
            Section("Rota çizimi") {
                RouteDrawSection(
                    noktalar: $form.noktalar,
                    basemap: $basemap,
                    seciliNokta: $seciliNokta,
                    hata: form.hatalar["koordinatlar"]
                )
            }

            Section("Rota bilgileri") {
                KBTextField(
                    title: "Rota Adı",
                    text: $form.ad,
                    required: true,
                    error: form.hatalar["ad"]
                )
                RoutePriorityField(oncelik: $form.oncelik)
                WeekDayField(gunler: $form.gunler, error: form.hatalar["gunler"])
                KBTextField(title: "Notlar", text: $form.notlar, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Rotayı Kaydet",
                    isSaving: form.isSaving,
                    isEnabled: form.isValid,
                    errorMessage: form.errorMessage
                ) {
                    Task {
                        if await form.save() {
                            onSaved()
                            dismiss()
                        }
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Yeni Çöp Rotası")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

/// Haftalık toplama günleri seçimi.
struct WeekDayField: View {
    @Binding var gunler: Set<Int>
    var error: String?

    var body: some View {
        KBFieldContainer(title: "Toplama Günleri", required: true, error: error) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(WeekDay.allCases) { gun in
                        let secili = gunler.contains(gun.rawValue)
                        Button {
                            if secili {
                                gunler.remove(gun.rawValue)
                            } else {
                                gunler.insert(gun.rawValue)
                            }
                        } label: {
                            Text(gun.kisaAd)
                        }
                        .buttonStyle(KBChipButtonStyle(tone: secili ? .info : .neutral))
                        .opacity(secili ? 1 : 0.55)
                        .accessibilityLabel(gun.ad)
                        .accessibilityAddTraits(secili ? [.isSelected] : [])
                    }
                }
            }
        }
    }
}

@MainActor
final class WasteRouteFormModel: ObservableObject {
    @Published var ad = ""
    @Published var noktalar: [KBCoordinate] = []
    @Published var gunler: Set<Int> = []
    @Published var oncelik: RoutePriority = .orta
    @Published var notlar = ""
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        var sonuc = RouteFormValidation.hatalar(ad: ad, noktalar: noktalar)
        if gunler.isEmpty { sonuc["gunler"] = "En az bir toplama günü seçin" }
        return sonuc
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createWasteRoute(
                WasteRouteRequestDTO(
                    ad: ad.trimmingCharacters(in: .whitespaces),
                    koordinatlar: KBGeo.pairs(noktalar),
                    gunler: gunler.sorted(),
                    oncelik: oncelik.rawValue,
                    notlar: notlar.bosDegilse
                )
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

// MARK: - Toplama formu

struct WasteCollectionFormView: View {
    let rota: WasteRouteDTO
    @ObservedObject var lookups: LookupStore
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = WasteCollectionFormModel()

    var body: some View {
        Form {
            Section("Rota") {
                KBDetailRow(label: "Rota", value: rota.ad)
                KBDetailRow(label: "Toplama günleri", value: rota.gunEtiketi)
            }

            Section("Geçiş") {
                KBPickerField(
                    title: "Araç",
                    items: lookups.araclar,
                    selection: $form.vehicleId,
                    placeholder: "Seçilmedi",
                    label: \.etiket
                )
                KBPickerField(
                    title: "Şoför",
                    items: lookups.soforler,
                    selection: $form.driverId,
                    placeholder: "Seçilmedi",
                    label: { $0.name ?? "—" }
                )
                KBDateField(
                    title: "Başlangıç",
                    date: $form.baslangic,
                    components: [.date, .hourAndMinute]
                )
                KBDateField(
                    title: "Bitiş",
                    date: $form.bitis,
                    components: [.date, .hourAndMinute],
                    error: form.hatalar["bitis"]
                )
                KBTextField(title: "Notlar", text: $form.notlar, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Toplamayı Kaydet",
                    isSaving: form.isSaving,
                    isEnabled: form.isValid,
                    errorMessage: form.errorMessage
                ) {
                    Task {
                        if await form.save(routeId: rota.id) {
                            onSaved()
                            dismiss()
                        }
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Çöp Toplama")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class WasteCollectionFormModel: ObservableObject {
    @Published var vehicleId: String?
    @Published var driverId: String?
    @Published var baslangic: Date? = Date()
    @Published var bitis: Date?
    @Published var notlar = ""
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        guard let baslangic, let bitis, bitis < baslangic else { return [:] }
        return ["bitis": "Bitiş başlangıçtan önce olamaz"]
    }

    var isValid: Bool { hatalar.isEmpty }

    func save(routeId: String) async -> Bool {
        guard isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createWasteCollection(
                WasteCollectionRequestDTO(
                    routeId: routeId,
                    vehicleId: vehicleId,
                    driverId: driverId,
                    baslangic: baslangic?.kbIsoAn,
                    bitis: bitis?.kbIsoAn,
                    notlar: notlar.bosDegilse
                )
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}
