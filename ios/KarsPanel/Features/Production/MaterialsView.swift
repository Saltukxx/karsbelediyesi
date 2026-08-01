import SwiftUI

/// `/malzeme-depo` — stok durumu ve hareketler.
struct MaterialsView: View {
    private enum Tab: String, CaseIterable, Identifiable {
        case stok
        case hareket

        var id: String { rawValue }
        var label: String { self == .stok ? "Stok Durumu" : "Hareketler" }
    }

    @StateObject private var viewModel = MaterialsViewModel()
    @EnvironmentObject private var session: AppSession
    @State private var tab: Tab = .stok
    @State private var malzemeFormu = false
    @State private var hareketFormu = false

    var body: some View {
        KBModuleScreen(
            title: NavDestination.malzemeDepo.label,
            icon: NavDestination.malzemeDepo.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: tab == .stok ? viewModel.materials.isEmpty : viewModel.movements.isEmpty,
            emptyMessage: tab == .stok
                ? "Depoda tanımlı malzeme yok."
                : "Seçilen filtrede stok hareketi yok.",
            searchText: tab == .stok ? $viewModel.searchText : nil,
            searchPrompt: "Malzeme kodu veya adı",
            newItemLabel: session.canManageOperations
                ? (tab == .stok ? "Yeni Malzeme" : "Yeni Hareket")
                : nil,
            onNewItem: session.canManageOperations
                ? { tab == .stok ? (malzemeFormu = true) : (hareketFormu = true) }
                : nil,
            onRefresh: { await viewModel.load() }
        ) {
            Section {
                Picker("Sekme", selection: $tab) {
                    ForEach(Tab.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                .listRowBackground(Color.clear)
            }

            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    .listRowBackground(Color.clear)
            }

            if tab == .stok {
                stokIcerigi
            } else {
                hareketIcerigi
            }
        }
        .onChange(of: viewModel.searchText) { _, _ in viewModel.searchChanged() }
        .onChange(of: viewModel.kategori) { _, _ in Task { await viewModel.loadMaterials() } }
        .onChange(of: viewModel.sadeceKritik) { _, _ in Task { await viewModel.loadMaterials() } }
        .onChange(of: viewModel.hareketTipi) { _, _ in Task { await viewModel.loadMovements() } }
        .task { if viewModel.materials.isEmpty { await viewModel.load() } }
        .sheet(isPresented: $malzemeFormu) {
            NavigationStack { MaterialFormView { Task { await viewModel.load() } } }
        }
        .sheet(isPresented: $hareketFormu) {
            NavigationStack {
                MaterialMovementFormView(materials: viewModel.materials) {
                    Task { await viewModel.load() }
                }
            }
        }
    }

    @ViewBuilder
    private var stokIcerigi: some View {
        Section("Filtre") {
            Picker("Kategori", selection: $viewModel.kategori) {
                Text("Tümü").tag(String?.none)
                ForEach(viewModel.kategoriler, id: \.self) { Text($0).tag(Optional($0)) }
            }
            .pickerStyle(.menu)
            Toggle("Yalnızca kritik stok", isOn: $viewModel.sadeceKritik)
        }

        Section("Malzemeler (\(viewModel.total))") {
            ForEach(viewModel.materials) { row in
                KBListRow(
                    title: "\(row.kod) — \(row.ad)",
                    subtitle: "\(row.kategori) · \(row.depoLokasyon ?? "Depo belirtilmemiş")",
                    detail: stokDetay(row),
                    badge: row.kritikMi ? "Kritik" : nil,
                    badgeTone: .danger,
                    trailingValue: KBNumberFormat.miktar(row.stokMiktari, birim: row.birim)
                )
                .task { await viewModel.loadMoreMaterialsIfNeeded(current: row) }
            }
        }
    }

    @ViewBuilder
    private var hareketIcerigi: some View {
        Section("Filtre") {
            Picker("Hareket tipi", selection: $viewModel.hareketTipi) {
                Text("Tümü").tag(StockMovementKind?.none)
                ForEach(StockMovementKind.allCases) { Text($0.displayName).tag(Optional($0)) }
            }
            .pickerStyle(.segmented)
        }

        Section("Hareketler (\(viewModel.movementTotal))") {
            ForEach(viewModel.movements) { row in
                KBListRow(
                    title: "\(row.malzemeKodu) — \(row.malzemeAdi)",
                    subtitle: hareketAltBaslik(row),
                    detail: row.aciklama,
                    badge: StockMovementKind(rawValue: row.tip)?.displayName ?? row.tip,
                    badgeTone: (StockMovementKind(rawValue: row.tip)?.badgeTone ?? .neutral).badge,
                    trailingValue: KBNumberFormat.miktar(row.miktar, birim: row.birim)
                )
                .task { await viewModel.loadMoreMovementsIfNeeded(current: row) }
            }
        }
    }

    private func stokDetay(_ row: MaterialDTO) -> String {
        var parts = [
            "Giriş \(KBNumberFormat.miktar(row.toplamGiris))",
            "Çıkış \(KBNumberFormat.miktar(row.toplamCikis))",
            "Kritik \(KBNumberFormat.miktar(row.kritikStok))",
        ]
        if row.birimFiyat != nil {
            parts.append("Değer \(KBNumberFormat.para(row.stokDegeri))")
        }
        return parts.joined(separator: " · ")
    }

    private func hareketAltBaslik(_ row: MaterialMovementDTO) -> String {
        var parts = [row.tarih.kbGun]
        if let mudurluk = row.mudurluk { parts.append(mudurluk) }
        if let belge = row.belgeNo { parts.append("Belge: \(belge)") }
        if let gorev = row.gorevNo { parts.append("Görev: \(gorev)") }
        if row.otomatikMi { parts.append("Otomatik") }
        return parts.joined(separator: " · ")
    }
}

@MainActor
final class MaterialsViewModel: ObservableObject {
    @Published private(set) var materials: [MaterialDTO] = []
    @Published private(set) var movements: [MaterialMovementDTO] = []
    @Published private(set) var kategoriler: [String] = []
    @Published var searchText = ""
    @Published var kategori: String?
    @Published var sadeceKritik = false
    @Published var hareketTipi: StockMovementKind?
    @Published private(set) var total = 0
    @Published private(set) var movementTotal = 0
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient
    private var materialPage = PageRequest()
    private var movementPage = PageRequest()
    private var materialsHasMore = false
    private var movementsHasMore = false
    private var isLoadingMore = false
    private var aramaGorevi: Task<Void, Never>?

    init(api: APIClient = .shared) {
        self.api = api
    }

    var ozet: [KBStat] {
        let kritik = materials.filter(\.kritikMi).count
        let deger = materials.map(\.stokDegeri).reduce(0, +)
        return [
            KBStat(label: "Malzeme", value: "\(total)"),
            KBStat(label: "Kritik stok", value: "\(kritik)", tone: kritik > 0 ? .danger : .success),
            KBStat(label: "Görünen stok değeri", value: KBNumberFormat.para(deger), tone: .accent),
        ]
    }

    func load() async {
        isLoading = true
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadMaterials(showSpinner: false) }
            group.addTask { await self.loadMovements(showSpinner: false) }
        }
        isLoading = false
    }

    func loadMaterials(showSpinner: Bool = true) async {
        materialPage = PageRequest()
        if showSpinner { isLoading = true }
        errorMessage = nil
        do {
            let response = try await api.fetchMaterialPage(
                page: materialPage,
                arama: searchText.bosDegilse,
                kategori: kategori,
                sadeceKritik: sadeceKritik
            )
            materials = response.items
            total = response.total
            kategoriler = response.kategoriler
            materialsHasMore = response.page * response.pageSize < response.total
        } catch {
            errorMessage = APIError.describe(error)
        }
        if showSpinner { isLoading = false }
    }

    func loadMovements(showSpinner: Bool = true) async {
        movementPage = PageRequest()
        if showSpinner { isLoading = true }
        do {
            let response = try await api.fetchMaterialMovements(
                page: movementPage,
                tip: hareketTipi?.rawValue
            )
            movements = response.items
            movementTotal = response.total
            movementsHasMore = response.hasMore
        } catch {
            errorMessage = APIError.describe(error)
        }
        if showSpinner { isLoading = false }
    }

    func searchChanged() {
        aramaGorevi?.cancel()
        aramaGorevi = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            await loadMaterials()
        }
    }

    func loadMoreMaterialsIfNeeded(current row: MaterialDTO) async {
        guard materialsHasMore, !isLoadingMore, materials.last?.id == row.id else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let next = materialPage.next
            let response = try await api.fetchMaterialPage(
                page: next,
                arama: searchText.bosDegilse,
                kategori: kategori,
                sadeceKritik: sadeceKritik
            )
            materialPage = next
            materials.append(contentsOf: response.items)
            materialsHasMore = response.page * response.pageSize < response.total
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    func loadMoreMovementsIfNeeded(current row: MaterialMovementDTO) async {
        guard movementsHasMore, !isLoadingMore, movements.last?.id == row.id else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let next = movementPage.next
            let response = try await api.fetchMaterialMovements(
                page: next,
                tip: hareketTipi?.rawValue
            )
            movementPage = next
            movements.append(contentsOf: response.items)
            movementsHasMore = response.hasMore
        } catch {
            errorMessage = APIError.describe(error)
        }
    }
}

struct MaterialFormView: View {
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = MaterialFormModel()

    var body: some View {
        Form {
            Section("Tanım") {
                KBTextField(
                    title: "Malzeme kodu",
                    text: $form.kod,
                    required: true,
                    placeholder: "MLZ-001",
                    capitalization: .characters,
                    error: form.hatalar["kod"]
                )
                KBTextField(
                    title: "Malzeme adı",
                    text: $form.ad,
                    required: true,
                    error: form.hatalar["ad"]
                )
                KBTextField(
                    title: "Kategori",
                    text: $form.kategori,
                    required: true,
                    error: form.hatalar["kategori"]
                )
                KBTextField(
                    title: "Birim",
                    text: $form.birim,
                    required: true,
                    placeholder: "adet / kg / m³",
                    error: form.hatalar["birim"]
                )
                KBTextField(title: "Depo lokasyonu", text: $form.depoLokasyon)
            }

            Section("Stok ve fiyat") {
                KBNumberField(
                    title: "Kritik stok seviyesi",
                    text: $form.kritikStok,
                    error: form.hatalar["kritikStok"]
                )
                KBNumberField(
                    title: "Birim fiyat",
                    text: $form.birimFiyat,
                    suffix: "₺",
                    error: form.hatalar["birimFiyat"]
                )
            }

            Section("Açıklama") {
                KBTextField(title: "Açıklama", text: $form.aciklama, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Malzemeyi Kaydet",
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
        .navigationTitle("Yeni Malzeme")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class MaterialFormModel: ObservableObject {
    @Published var kod = ""
    @Published var ad = ""
    @Published var kategori = ""
    @Published var birim = ""
    @Published var depoLokasyon = ""
    @Published var kritikStok = ""
    @Published var birimFiyat = ""
    @Published var aciklama = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if kod.bosDegilse == nil { result["kod"] = "Kod zorunlu" }
        if ad.bosDegilse == nil { result["ad"] = "Ad zorunlu" }
        if kategori.bosDegilse == nil { result["kategori"] = "Kategori zorunlu" }
        if birim.bosDegilse == nil { result["birim"] = "Birim zorunlu" }
        for (key, value) in [("kritikStok", kritikStok), ("birimFiyat", birimFiyat)]
        where KBNumberFormat.isInvalid(value) {
            result[key] = "Geçerli bir sayı girin"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let kod = kod.bosDegilse,
              let ad = ad.bosDegilse,
              let kategori = kategori.bosDegilse,
              let birim = birim.bosDegilse else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createMaterial(
                MaterialRequestDTO(
                    kod: kod.uppercased(),
                    ad: ad,
                    kategori: kategori,
                    birim: birim,
                    depoLokasyon: depoLokasyon.bosDegilse,
                    kritikStok: KBNumberFormat.parse(kritikStok),
                    birimFiyat: KBNumberFormat.parse(birimFiyat),
                    aciklama: aciklama.bosDegilse
                )
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

struct MaterialMovementFormView: View {
    let materials: [MaterialDTO]
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = MaterialMovementFormModel()
    @ObservedObject private var lookups = LookupStore.shared

    private var secilen: MaterialDTO? {
        materials.first { $0.id == form.materialId }
    }

    var body: some View {
        Form {
            Section("Hareket") {
                KBPickerField(
                    title: "Malzeme",
                    items: materials,
                    selection: $form.materialId,
                    required: true,
                    placeholder: "Malzeme seçin",
                    error: form.hatalar["materialId"],
                    label: { "\($0.kod) — \($0.ad)" }
                )
                KBEnumField(title: "Hareket tipi", selection: $form.tip)
                KBDateField(title: "Tarih", date: $form.tarih, required: true)
                KBNumberField(
                    title: "Miktar",
                    text: $form.miktar,
                    required: true,
                    suffix: secilen?.birim,
                    error: form.hatalar["miktar"]
                )
                if let secilen, form.tip == .CIKIS {
                    KBDetailRow(
                        label: "Mevcut stok",
                        value: KBNumberFormat.miktar(secilen.stokMiktari, birim: secilen.birim)
                    )
                }
            }

            Section("Belge") {
                KBPickerField(
                    title: "Müdürlük",
                    items: lookups.mudurlukler,
                    selection: $form.departmentId,
                    label: { $0.name ?? "—" }
                )
                KBTextField(title: "Belge no", text: $form.belgeNo)
                KBTextField(title: "Açıklama", text: $form.aciklama, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Hareketi Kaydet",
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
        .navigationTitle("Stok Hareketi")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .task { await lookups.loadIfNeeded() }
    }
}

@MainActor
final class MaterialMovementFormModel: ObservableObject {
    @Published var materialId: String?
    @Published var tip: StockMovementKind = .GIRIS
    @Published var tarih: Date? = Date()
    @Published var miktar = ""
    @Published var departmentId: String?
    @Published var belgeNo = ""
    @Published var aciklama = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if materialId == nil { result["materialId"] = "Malzeme seçin" }
        if let miktarDeger = KBNumberFormat.parse(miktar) {
            if miktarDeger <= 0 { result["miktar"] = "Miktar sıfırdan büyük olmalı" }
        } else {
            result["miktar"] = "Miktar zorunlu"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let materialId, let miktarDeger = KBNumberFormat.parse(miktar), isValid else {
            return false
        }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createMaterialMovement(
                MaterialMovementRequestDTO(
                    materialId: materialId,
                    tarih: tarih?.kbIsoGun,
                    tip: tip.rawValue,
                    miktar: miktarDeger,
                    departmentId: departmentId,
                    belgeNo: belgeNo.bosDegilse,
                    aciklama: aciklama.bosDegilse,
                    vehicleTaskId: nil
                )
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}
