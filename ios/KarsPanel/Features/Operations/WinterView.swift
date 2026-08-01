import SwiftUI

/// `/kis` — kar küreme / tuzlama rotaları ve operasyon kayıtları.
/// Tuz girildiğinde sunucu depo stoğundan otomatik çıkış yazar.
struct WinterView: View {
    @StateObject private var viewModel = WinterViewModel()
    @ObservedObject private var lookups = LookupStore.shared
    @State private var basemap: KBMapBasemap = .standart
    @State private var rotaFormu = false
    @State private var operasyonRotasi: WinterRouteDTO?
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
                    Text("Tanımlı kış rotası yok")
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
                ForEach(viewModel.rotalar) { rota in
                    VStack(alignment: .leading, spacing: 8) {
                        RouteSummaryRow(
                            rota: rota,
                            detay: [
                                rota.tipi?.displayName ?? rota.tip,
                                rota.sonOperasyon.map { "Son geçiş: \($0.kbAn)" },
                            ]
                            .compactMap { $0 }
                            .joined(separator: " · ")
                        )

                        if !rota.sonOperasyonlar.isEmpty {
                            ForEach(rota.sonOperasyonlar.prefix(3)) { op in
                                WinterOperationRow(
                                    operasyon: op,
                                    silinebilir: viewModel.duzenleyebilir,
                                    onSil: { Task { await viewModel.operasyonSil(op) } }
                                )
                            }
                        }

                        if viewModel.duzenleyebilir {
                            HStack(spacing: 8) {
                                Button("Operasyon Ekle") { operasyonRotasi = rota }
                                    .buttonStyle(KBChipButtonStyle(tone: .info))
                                Button("Araç Ata") {
                                    atamaHedefi = SmartAssignTarget(
                                        tip: .KIS,
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
        .navigationTitle(NavDestination.kis.label)
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await viewModel.load() }
        .toolbar {
            if viewModel.duzenleyebilir {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        rotaFormu = true
                    } label: {
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
                WinterRouteFormView { Task { await viewModel.load() } }
            }
        }
        .sheet(item: $operasyonRotasi) { rota in
            NavigationStack {
                WinterOperationFormView(
                    rota: rota,
                    malzemeler: viewModel.malzemeler,
                    lookups: lookups
                ) {
                    Task { await viewModel.load() }
                }
            }
        }
        .smartAssignSheet($atamaHedefi) { Task { await viewModel.load() } }
    }
}

private struct WinterOperationRow: View {
    let operasyon: WinterOperationDTO
    let silinebilir: Bool
    let onSil: () -> Void

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(operasyon.baslangic.kbAn)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
                Text(
                    [
                        WinterOperationKind(rawValue: operasyon.tip)?.displayName
                            ?? operasyon.tip,
                        operasyon.plaka,
                        operasyon.soforAdi,
                        operasyon.tuzKg.map { KBNumberFormat.miktar($0, birim: "kg tuz") },
                    ]
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
final class WinterViewModel: ObservableObject {
    @Published private(set) var veri: WinterOverviewDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var rotalar: [WinterRouteDTO] { veri?.rotalar ?? [] }
    var malzemeler: [SaltMaterialDTO] { veri?.malzemeler ?? [] }
    var duzenleyebilir: Bool { veri?.duzenleyebilir ?? false }

    var ozet: [KBStat] {
        let aktif = rotalar.filter(\.aktif).count
        let operasyonlar = rotalar.flatMap(\.sonOperasyonlar)
        let tuz = operasyonlar.compactMap(\.tuzKg).reduce(0, +)
        return [
            KBStat(label: "Aktif rota", value: "\(aktif) / \(rotalar.count)", tone: .info),
            KBStat(label: "Son geçişler", value: String(operasyonlar.count), tone: .neutral),
            KBStat(label: "Kullanılan tuz", value: KBNumberFormat.miktar(tuz, birim: "kg"), tone: .warning),
        ]
    }

    var polylines: [KBMapPolyline] {
        rotalar.map { rota in
            KBMapPolyline(
                id: rota.id,
                coordinates: KBGeo.coordinates(rota.koordinatlar),
                style: rota.aktif ? .kis : .pasif
            )
        }
    }

    var kadrajAnahtari: String { "kis-\(rotalar.count)" }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            veri = try await api.fetchWinterOverview()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func aktiflikDegistir(_ rota: WinterRouteDTO) async {
        await calistir {
            _ = try await self.api.updateWinterRoute(
                id: rota.id,
                body: OperationRoutePatchDTO(aktif: !rota.aktif)
            )
        }
    }

    func rotaSil(_ rota: WinterRouteDTO) async {
        await calistir { _ = try await self.api.deleteWinterRoute(id: rota.id) }
    }

    func operasyonSil(_ operasyon: WinterOperationDTO) async {
        await calistir { _ = try await self.api.deleteWinterOperation(id: operasyon.id) }
    }

    /// Kullanımdaki rota sunucuda pasife alınıp 409 döner; liste yine tazelenir.
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

struct WinterRouteFormView: View {
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = WinterRouteFormModel()
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
                KBEnumField(title: "Tip", selection: $form.tip)
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
        .navigationTitle("Yeni Kış Rotası")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class WinterRouteFormModel: ObservableObject {
    @Published var ad = ""
    @Published var noktalar: [KBCoordinate] = []
    @Published var tip: WinterRouteKind = .KARMA
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
            _ = try await api.createWinterRoute(
                WinterRouteRequestDTO(
                    ad: ad.trimmingCharacters(in: .whitespaces),
                    koordinatlar: KBGeo.pairs(noktalar),
                    tip: tip.rawValue,
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

// MARK: - Operasyon formu

struct WinterOperationFormView: View {
    let rota: WinterRouteDTO
    let malzemeler: [SaltMaterialDTO]
    @ObservedObject var lookups: LookupStore
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = WinterOperationFormModel()

    var body: some View {
        Form {
            Section("Rota") {
                KBDetailRow(label: "Rota", value: rota.ad)
                KBDetailRow(label: "Tip", value: rota.tipi?.displayName ?? rota.tip)
            }

            Section("Geçiş") {
                KBEnumField(title: "Operasyon Tipi", selection: $form.tip)
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
            }

            Section("Tuz düşümü") {
                KBNumberField(
                    title: "Kullanılan Tuz",
                    text: $form.tuzKg,
                    suffix: "kg",
                    error: form.hatalar["tuzKg"]
                )
                KBPickerField(
                    title: "Depo Kalemi",
                    items: malzemeler,
                    selection: $form.tuzMaterialId,
                    placeholder: "Seçilmedi",
                    error: form.hatalar["tuzMaterialId"],
                    label: \.etiket
                )
                Text("Tuz girildiğinde depo stoğundan otomatik çıkış hareketi yazılır.")
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }

            Section {
                KBTextField(title: "Notlar", text: $form.notlar, multiline: true)
                KBFormActions(
                    saveTitle: "Operasyonu Kaydet",
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
        .navigationTitle("Kış Operasyonu")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class WinterOperationFormModel: ObservableObject {
    @Published var tip: WinterOperationKind = .KARMA
    @Published var vehicleId: String?
    @Published var driverId: String?
    @Published var baslangic: Date? = Date()
    @Published var bitis: Date?
    @Published var tuzKg = ""
    @Published var tuzMaterialId: String?
    @Published var notlar = ""
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        var sonuc: [String: String] = [:]
        if KBNumberFormat.isInvalid(tuzKg) { sonuc["tuzKg"] = "Geçerli bir miktar girin" }
        if let miktar = KBNumberFormat.parse(tuzKg) {
            if miktar <= 0 { sonuc["tuzKg"] = "Tuz miktarı 0'dan büyük olmalı" }
            if tuzMaterialId == nil {
                sonuc["tuzMaterialId"] = "Tuz düşümü için depo kalemi seçin"
            }
        }
        if let baslangic, let bitis, bitis < baslangic {
            sonuc["bitis"] = "Bitiş başlangıçtan önce olamaz"
        }
        return sonuc
    }

    var isValid: Bool { hatalar.isEmpty }

    func save(routeId: String) async -> Bool {
        guard isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createWinterOperation(
                WinterOperationRequestDTO(
                    routeId: routeId,
                    tip: tip.rawValue,
                    vehicleId: vehicleId,
                    driverId: driverId,
                    baslangic: baslangic?.kbIsoAn,
                    bitis: bitis?.kbIsoAn,
                    tuzKg: KBNumberFormat.parse(tuzKg),
                    tuzMaterialId: tuzMaterialId,
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

// MARK: - Ortak alanlar

/// Üç modülün de kullandığı 1–3 öncelik seçimi.
struct RoutePriorityField: View {
    @Binding var oncelik: RoutePriority

    var body: some View {
        KBFieldContainer(title: "Öncelik", required: true, error: nil) {
            Picker("Öncelik", selection: $oncelik) {
                ForEach(RoutePriority.allCases) { item in
                    Text(item.displayName).tag(item)
                }
            }
            .labelsHidden()
            .pickerStyle(.segmented)
        }
    }
}
