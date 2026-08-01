import SwiftUI

/// `/personel` — personel listesi, kartı ve formu.
struct PersonnelListView: View {
    @StateObject private var viewModel = PersonnelViewModel()
    @EnvironmentObject private var session: AppSession
    @State private var formGosteriliyor = false

    var body: some View {
        KBModuleScreen(
            title: NavDestination.personel.label,
            icon: NavDestination.personel.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.rows.isEmpty,
            emptyMessage: "Personel kaydı yok. Sağ üstten ekleyebilirsiniz.",
            searchText: $viewModel.searchText,
            searchPrompt: "Ad soyad veya unvan",
            newItemLabel: session.canManageOperations ? "Yeni Personel" : nil,
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
                    Text("Tümü").tag(PersonnelStatus?.none)
                    ForEach(PersonnelStatus.allCases) { Text($0.displayName).tag(Optional($0)) }
                }
                .pickerStyle(.menu)
            }

            Section("Personel (\(viewModel.total))") {
                ForEach(viewModel.rows) { row in
                    NavigationLink(value: PanelRoute.personnel(row.id)) {
                        KBListRow(
                            title: row.adSoyad,
                            subtitle: [row.unvan, row.mudurluk]
                                .compactMap { $0 }.joined(separator: " · "),
                            detail: personelDetay(row),
                            badge: PersonnelStatus(rawValue: row.durum)?.displayName ?? row.durum,
                            badgeTone: (PersonnelStatus(rawValue: row.durum)?.badgeTone ?? .neutral)
                                .badge,
                            trailingValue: row.saatUcret.map {
                                "\(KBNumberFormat.para($0))/sa"
                            }
                        )
                    }
                    .task { await viewModel.loadMoreIfNeeded(current: row) }
                }
            }
        }
        .onChange(of: viewModel.searchText) { _, _ in viewModel.searchChanged() }
        .onChange(of: viewModel.durumFiltre) { _, _ in Task { await viewModel.load() } }
        .task { if viewModel.rows.isEmpty { await viewModel.load() } }
        .sheet(isPresented: $formGosteriliyor) {
            NavigationStack {
                PersonnelFormView(mode: .create) { Task { await viewModel.load() } }
            }
        }
    }

    private func personelDetay(_ row: PersonnelFullDTO) -> String? {
        var parts: [String] = []
        if let telefon = row.telefon { parts.append(telefon) }
        if let giris = row.iseGirisTarihi { parts.append("Giriş: \(giris.kbGun)") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

struct PersonnelDetailView: View {
    @StateObject private var viewModel: PersonnelDetailViewModel
    @EnvironmentObject private var session: AppSession
    @State private var duzenleGosteriliyor = false

    init(personnelId: String) {
        _viewModel = StateObject(wrappedValue: PersonnelDetailViewModel(personnelId: personnelId))
    }

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if let card = viewModel.card {
                Section("Künye") {
                    KBDetailRow(label: "Ad soyad", value: card.personel.adSoyad)
                    KBDetailRow(label: "Unvan", value: card.personel.unvan)
                    KBDetailRow(label: "Müdürlük", value: card.personel.mudurluk)
                    KBDetailRow(label: "Telefon", value: card.personel.telefon)
                    KBDetailRow(label: "İşe giriş", value: card.personel.iseGirisTarihi.kbGun)
                    KBDetailRow(
                        label: "Durum",
                        value: PersonnelStatus(rawValue: card.personel.durum)?.displayName
                            ?? card.personel.durum
                    )
                    KBDetailRow(
                        label: "Saat ücreti",
                        value: card.personel.saatUcret.map { KBNumberFormat.para($0) }
                    )
                }

                Section {
                    KBStatRow(tiles: viewModel.ozet)
                        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                        .listRowBackground(Color.clear)
                }

                if let not = card.personel.not, !not.isEmpty {
                    Section("Not") { Text(not).font(.subheadline) }
                }

                Section("Mesai kayıtları") {
                    if card.mesailer.isEmpty {
                        Text("Kayıt yok").font(.subheadline).foregroundStyle(KBTheme.muted)
                    } else {
                        ForEach(card.mesailer) { row in
                            KBListRow(
                                title: row.tarih.kbGun,
                                subtitle: WorkKind(rawValue: row.calismaTipi)?.displayName
                                    ?? row.calismaTipi,
                                detail: "\(row.girisSaati) – \(row.cikisSaati)"
                                    + " · Normal \(KBNumberFormat.miktar(row.normalSaat, birim: "sa"))"
                                    + " · Mesai \(KBNumberFormat.miktar(row.mesaiSaat, birim: "sa"))",
                                trailingValue: KBNumberFormat.miktar(row.toplamSaat, birim: "sa")
                            )
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(viewModel.card?.personel.adSoyad ?? "Personel")
        .toolbar {
            if session.canManageOperations, viewModel.card != nil {
                ToolbarItem(placement: .primaryAction) {
                    Button("Düzenle") { duzenleGosteriliyor = true }
                }
            }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading, viewModel.card == nil { LoadingOverlay() } }
        .sheet(isPresented: $duzenleGosteriliyor) {
            if let personel = viewModel.card?.personel {
                NavigationStack {
                    PersonnelFormView(mode: .edit(personel)) { Task { await viewModel.load() } }
                }
            }
        }
    }
}

@MainActor
final class PersonnelViewModel: ObservableObject {
    @Published private(set) var rows: [PersonnelFullDTO] = []
    @Published var searchText = ""
    @Published var durumFiltre: PersonnelStatus?
    @Published private(set) var total = 0
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient
    private var page = PageRequest()
    private var hasMore = false
    private var isLoadingMore = false
    private var aramaGorevi: Task<Void, Never>?

    init(api: APIClient = .shared) {
        self.api = api
    }

    var ozet: [KBStat] {
        [
            KBStat(label: "Kayıt", value: "\(total)"),
            KBStat(
                label: "Aktif",
                value: "\(rows.filter { $0.durum == PersonnelStatus.AKTIF.rawValue }.count)",
                tone: .success
            ),
            KBStat(
                label: "İzinli / raporlu",
                value: "\(rows.filter { $0.durum == PersonnelStatus.IZINLI.rawValue || $0.durum == PersonnelStatus.RAPORLU.rawValue }.count)",
                tone: .warning
            ),
        ]
    }

    func load() async {
        page = PageRequest()
        isLoading = true
        errorMessage = nil
        do {
            let response = try await api.fetchPersonnelPage(
                page: page,
                arama: searchText.bosDegilse,
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

    func searchChanged() {
        aramaGorevi?.cancel()
        aramaGorevi = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            await load()
        }
    }

    func loadMoreIfNeeded(current row: PersonnelFullDTO) async {
        guard hasMore, !isLoadingMore, rows.last?.id == row.id else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let next = page.next
            let response = try await api.fetchPersonnelPage(
                page: next,
                arama: searchText.bosDegilse,
                durum: durumFiltre?.rawValue
            )
            page = next
            rows.append(contentsOf: response.items)
            hasMore = response.hasMore
        } catch {
            errorMessage = APIError.describe(error)
        }
    }
}

@MainActor
final class PersonnelDetailViewModel: ObservableObject {
    @Published private(set) var card: PersonnelCardDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient
    private let personnelId: String

    init(personnelId: String, api: APIClient = .shared) {
        self.personnelId = personnelId
        self.api = api
    }

    var ozet: [KBStat] {
        guard let card else { return [] }
        var tiles = [
            KBStat(
                label: "Toplam saat",
                value: KBNumberFormat.miktar(card.ozet.toplamSaat, birim: "sa")
            ),
            KBStat(
                label: "Fazla mesai",
                value: KBNumberFormat.miktar(card.ozet.toplamMesaiSaat, birim: "sa"),
                tone: .warning
            ),
        ]
        if let ucret = card.ozet.saatUcret {
            tiles.append(
                KBStat(
                    label: "Tahmini maliyet",
                    value: KBNumberFormat.para(card.ozet.toplamSaat * ucret),
                    tone: .accent
                )
            )
        }
        return tiles
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            card = try await api.fetchPersonnelCard(id: personnelId)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }
}

struct PersonnelFormView: View {
    enum Mode {
        case create
        case edit(PersonnelFullDTO)

        var isEdit: Bool {
            if case .edit = self { return true }
            return false
        }
    }

    let mode: Mode
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form: PersonnelFormModel
    @ObservedObject private var lookups = LookupStore.shared

    init(mode: Mode, onSaved: @escaping () -> Void) {
        self.mode = mode
        self.onSaved = onSaved
        _form = StateObject(wrappedValue: PersonnelFormModel(mode: mode))
    }

    var body: some View {
        Form {
            Section("Künye") {
                KBTextField(
                    title: "Ad soyad",
                    text: $form.adSoyad,
                    required: true,
                    capitalization: .words,
                    error: form.hatalar["adSoyad"]
                )
                KBTextField(title: "Unvan", text: $form.unvan)
                KBPickerField(
                    title: "Müdürlük",
                    items: lookups.mudurlukler,
                    selection: $form.departmentId,
                    label: { $0.name ?? "—" }
                )
                KBTextField(
                    title: "Telefon",
                    text: $form.telefon,
                    placeholder: "5xxxxxxxxx",
                    keyboard: .phonePad
                )
                KBDateField(title: "İşe giriş tarihi", date: $form.iseGirisTarihi)
                KBEnumField(title: "Durum", selection: $form.durum)
                KBNumberField(
                    title: "Saat ücreti",
                    text: $form.saatUcret,
                    suffix: "₺/sa",
                    error: form.hatalar["saatUcret"]
                )
            }

            Section("Not") {
                KBTextField(title: "Not", text: $form.not, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: mode.isEdit ? "Değişiklikleri Kaydet" : "Personeli Kaydet",
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
        .navigationTitle(mode.isEdit ? "Personeli Düzenle" : "Yeni Personel")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .task { await lookups.loadIfNeeded() }
    }
}

@MainActor
final class PersonnelFormModel: ObservableObject {
    @Published var adSoyad = ""
    @Published var unvan = ""
    @Published var departmentId: String?
    @Published var telefon = ""
    @Published var iseGirisTarihi: Date?
    @Published var durum: PersonnelStatus = .AKTIF
    @Published var saatUcret = ""
    @Published var not = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient
    private let duzenlenenId: String?

    init(mode: PersonnelFormView.Mode, api: APIClient = .shared) {
        self.api = api
        guard case let .edit(personel) = mode else {
            duzenlenenId = nil
            return
        }
        duzenlenenId = personel.id
        adSoyad = personel.adSoyad
        unvan = personel.unvan ?? ""
        departmentId = personel.departmentId
        telefon = personel.telefon ?? ""
        iseGirisTarihi = personel.iseGirisTarihi
        durum = PersonnelStatus(rawValue: personel.durum) ?? .AKTIF
        saatUcret = KBNumberFormat.text(personel.saatUcret)
        not = personel.not ?? ""
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if adSoyad.bosDegilse == nil { result["adSoyad"] = "Ad soyad zorunlu" }
        if KBNumberFormat.isInvalid(saatUcret) { result["saatUcret"] = "Geçerli bir sayı girin" }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let ad = adSoyad.bosDegilse, isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let body = PersonnelRequestDTO(
            adSoyad: ad,
            unvan: unvan.bosDegilse,
            departmentId: departmentId,
            telefon: telefon.bosDegilse,
            iseGirisTarihi: iseGirisTarihi?.kbIsoGun,
            durum: durum.rawValue,
            not: not.bosDegilse,
            saatUcret: KBNumberFormat.parse(saatUcret)
        )

        do {
            if let duzenlenenId {
                _ = try await api.updatePersonnel(id: duzenlenenId, body: body)
            } else {
                _ = try await api.createPersonnel(body)
            }
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}
