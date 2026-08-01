import SwiftUI

/// `/bakim` — bakım takip listesi + kayıt formu.
struct MaintenanceView: View {
    @StateObject private var viewModel = MaintenanceViewModel()
    @EnvironmentObject private var session: AppSession
    @State private var formGosteriliyor = false

    var body: some View {
        KBModuleScreen(
            title: NavDestination.bakim.label,
            icon: NavDestination.bakim.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.rows.isEmpty,
            emptyMessage: "Bakım kaydı yok. Sağ üstten yeni bakım girebilirsiniz.",
            newItemLabel: session.canManageOperations ? "Yeni Bakım" : nil,
            onNewItem: session.canManageOperations ? { formGosteriliyor = true } : nil,
            onRefresh: { await viewModel.load() }
        ) {
            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    .listRowBackground(Color.clear)
            }

            Section {
                Picker("Durum", selection: $viewModel.durumFiltre) {
                    Text("Tümü").tag(MaintenanceStatus?.none)
                    ForEach(MaintenanceStatus.allCases) { durum in
                        Text(durum.displayName).tag(Optional(durum))
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Bakımlar (\(viewModel.total))") {
                ForEach(viewModel.rows) { row in
                    KBListRow(
                        title: row.plaka,
                        subtitle: MaintenanceKind(rawValue: row.bakimTuru)?.displayName
                            ?? row.bakimTuru,
                        detail: bakimDetay(row),
                        badge: MaintenanceStatus(rawValue: row.durum)?.displayName ?? row.durum,
                        badgeTone: (MaintenanceStatus(rawValue: row.durum)?.badgeTone ?? .neutral)
                            .badge,
                        trailingValue: KBNumberFormat.para(row.maliyet)
                    )
                    .task { await viewModel.loadMoreIfNeeded(current: row) }
                }
                if viewModel.isLoadingMore {
                    HStack { Spacer(); ProgressView(); Spacer() }
                }
            }
        }
        .onChange(of: viewModel.durumFiltre) { _, _ in Task { await viewModel.load() } }
        .task { if viewModel.rows.isEmpty { await viewModel.load() } }
        .sheet(isPresented: $formGosteriliyor) {
            NavigationStack {
                MaintenanceFormView { Task { await viewModel.load() } }
            }
        }
    }

    private func bakimDetay(_ row: MaintenanceDTO) -> String? {
        var parts = [row.bakimTarihi.kbGun]
        if let islem = row.yapilanIslemler, !islem.isEmpty { parts.append(islem) }
        if row.otomatikOlusturuldu { parts.append("Kontrol listesinden otomatik") }
        return parts.joined(separator: " · ")
    }
}

@MainActor
final class MaintenanceViewModel: ObservableObject {
    @Published var rows: [MaintenanceDTO] = []
    @Published var durumFiltre: MaintenanceStatus?
    @Published private(set) var total = 0
    @Published private(set) var isLoading = false
    @Published private(set) var isLoadingMore = false
    @Published var errorMessage: String?

    private let api: APIClient
    private var page = PageRequest()
    private var hasMore = false
    /// Araç kartından açıldığında yalnızca o aracın kayıtları
    let vehicleId: String?

    init(vehicleId: String? = nil, api: APIClient = .shared) {
        self.vehicleId = vehicleId
        self.api = api
    }

    var ozet: [KBStat] {
        let toplamMaliyet = rows.compactMap(\.maliyet).reduce(0, +)
        return [
            KBStat(label: "Kayıt", value: "\(total)"),
            KBStat(label: "Görünen maliyet", value: KBNumberFormat.para(toplamMaliyet)),
            KBStat(
                label: "Devam eden",
                value: "\(rows.filter { $0.durum == MaintenanceStatus.DEVAM_EDIYOR.rawValue }.count)",
                tone: .warning
            ),
        ]
    }

    func load() async {
        page = PageRequest()
        isLoading = true
        errorMessage = nil
        do {
            let response = try await api.fetchMaintenancePage(
                page: page,
                vehicleId: vehicleId,
                durum: durumFiltre?.rawValue
            )
            rows = response.items
            total = response.total
            hasMore = response.hasMore
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func loadMoreIfNeeded(current row: MaintenanceDTO) async {
        guard hasMore, !isLoadingMore, rows.last?.id == row.id else { return }
        isLoadingMore = true
        do {
            let next = page.next
            let response = try await api.fetchMaintenancePage(
                page: next,
                vehicleId: vehicleId,
                durum: durumFiltre?.rawValue
            )
            page = next
            rows.append(contentsOf: response.items)
            hasMore = response.hasMore
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoadingMore = false
    }
}

struct MaintenanceFormView: View {
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = MaintenanceFormModel()
    @ObservedObject private var lookups = LookupStore.shared

    var body: some View {
        Form {
            Section("Araç ve tür") {
                KBPickerField(
                    title: "Araç",
                    items: lookups.araclar,
                    selection: $form.vehicleId,
                    required: true,
                    placeholder: "Araç seçin",
                    error: form.hatalar["vehicleId"],
                    label: \.etiket
                )
                KBEnumField(title: "Bakım türü", selection: $form.bakimTuru)
                KBEnumField(title: "Durum", selection: $form.durum)
                KBDateField(title: "Bakım tarihi", date: $form.bakimTarihi, required: true)
            }

            Section("Detay") {
                KBTextField(
                    title: "Yapılan işlemler",
                    text: $form.yapilanIslemler,
                    multiline: true
                )
                KBTextField(
                    title: "Kullanılan malzeme",
                    text: $form.kullanilanMalzeme,
                    multiline: true
                )
                KBTextField(title: "Yapan firma / personel", text: $form.yapanFirmaPersonel)
                KBNumberField(
                    title: "Maliyet",
                    text: $form.maliyet,
                    suffix: "₺",
                    error: form.hatalar["maliyet"]
                )
                KBDateField(title: "Sonraki bakım", date: $form.sonrakiBakimTarihi)
            }

            Section {
                KBFormActions(
                    saveTitle: "Bakımı Kaydet",
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
        .navigationTitle("Yeni Bakım")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .task { await lookups.loadIfNeeded() }
    }
}

@MainActor
final class MaintenanceFormModel: ObservableObject {
    @Published var vehicleId: String?
    @Published var bakimTuru: MaintenanceKind = .PERIYODIK
    @Published var durum: MaintenanceStatus = .TAMAMLANDI
    @Published var bakimTarihi: Date? = Date()
    @Published var yapilanIslemler = ""
    @Published var kullanilanMalzeme = ""
    @Published var yapanFirmaPersonel = ""
    @Published var maliyet = ""
    @Published var sonrakiBakimTarihi: Date?

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(vehicleId: String? = nil, api: APIClient = .shared) {
        self.vehicleId = vehicleId
        self.api = api
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if vehicleId == nil { result["vehicleId"] = "Araç seçin" }
        if KBNumberFormat.isInvalid(maliyet) { result["maliyet"] = "Geçerli bir sayı girin" }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let vehicleId, isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createMaintenance(
                MaintenanceRequestDTO(
                    vehicleId: vehicleId,
                    bakimTarihi: bakimTarihi?.kbIsoGun,
                    bakimTuru: bakimTuru.rawValue,
                    yapilanIslemler: yapilanIslemler.bosDegilse,
                    kullanilanMalzeme: kullanilanMalzeme.bosDegilse,
                    maliyet: KBNumberFormat.parse(maliyet),
                    yapanFirmaPersonel: yapanFirmaPersonel.bosDegilse,
                    sonrakiBakimTarihi: sonrakiBakimTarihi?.kbIsoGun,
                    durum: durum.rawValue
                )
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}
