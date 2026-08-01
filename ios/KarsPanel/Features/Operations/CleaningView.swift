import SwiftUI

/// `/temizlik` — süpürme/yıkama güzergahları. Geçiş kaydı yerine sevkiyat
/// ataması tutulur; "son görev" bilgisi dispatch'ten gelir.
struct CleaningView: View {
    @StateObject private var viewModel = CleaningViewModel()
    @State private var basemap: KBMapBasemap = .standart
    @State private var rotaFormu = false
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

            Section("Rotalar (\(viewModel.rotalar.count))") {
                if viewModel.rotalar.isEmpty {
                    Text("Tanımlı temizlik rotası yok")
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
                ForEach(viewModel.rotalar) { rota in
                    VStack(alignment: .leading, spacing: 8) {
                        RouteSummaryRow(
                            rota: rota,
                            detay: rota.sonGorev.map { "Son görev: \($0.kbAn)" }
                                ?? "Henüz görev atanmadı"
                        )

                        if viewModel.duzenleyebilir {
                            HStack(spacing: 8) {
                                Button("Araç Ata") {
                                    atamaHedefi = SmartAssignTarget(
                                        tip: .TEMIZLIK,
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
        .navigationTitle(NavDestination.temizlik.label)
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
        }
        .sheet(isPresented: $rotaFormu) {
            NavigationStack {
                CleaningRouteFormView { Task { await viewModel.load() } }
            }
        }
        .smartAssignSheet($atamaHedefi) { Task { await viewModel.load() } }
    }
}

@MainActor
final class CleaningViewModel: ObservableObject {
    @Published private(set) var veri: CleaningOverviewDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var rotalar: [CleaningRouteDTO] { veri?.rotalar ?? [] }
    var duzenleyebilir: Bool { veri?.duzenleyebilir ?? false }

    var ozet: [KBStat] {
        [
            KBStat(
                label: "Aktif rota",
                value: "\(rotalar.filter(\.aktif).count) / \(rotalar.count)",
                tone: .info
            ),
            KBStat(
                label: "Görev almış",
                value: String(rotalar.filter { $0.sonGorev != nil }.count),
                tone: .success
            ),
            KBStat(
                label: "Toplam uzunluk",
                value: KBGeo.uzunlukMetni(
                    rotalar.reduce(0) {
                        $0 + KBGeo.uzunlukMetre(KBGeo.coordinates($1.koordinatlar))
                    }
                ),
                tone: .neutral
            ),
        ]
    }

    var polylines: [KBMapPolyline] {
        rotalar.map { rota in
            KBMapPolyline(
                id: rota.id,
                coordinates: KBGeo.coordinates(rota.koordinatlar),
                style: rota.aktif ? .temizlik : .pasif
            )
        }
    }

    var kadrajAnahtari: String { "temizlik-\(rotalar.count)" }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            veri = try await api.fetchCleaningOverview()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func aktiflikDegistir(_ rota: CleaningRouteDTO) async {
        await calistir {
            _ = try await self.api.updateCleaningRoute(
                id: rota.id,
                body: OperationRoutePatchDTO(aktif: !rota.aktif)
            )
        }
    }

    func rotaSil(_ rota: CleaningRouteDTO) async {
        await calistir { _ = try await self.api.deleteCleaningRoute(id: rota.id) }
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

struct CleaningRouteFormView: View {
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = CleaningRouteFormModel()
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
        .navigationTitle("Yeni Temizlik Rotası")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class CleaningRouteFormModel: ObservableObject {
    @Published var ad = ""
    @Published var noktalar: [KBCoordinate] = []
    @Published var oncelik: RoutePriority = .orta
    @Published var notlar = ""
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] { RouteFormValidation.hatalar(ad: ad, noktalar: noktalar) }
    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createCleaningRoute(
                CleaningRouteRequestDTO(
                    ad: ad.trimmingCharacters(in: .whitespaces),
                    koordinatlar: KBGeo.pairs(noktalar),
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
