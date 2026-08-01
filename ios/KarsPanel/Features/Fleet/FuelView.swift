import SwiftUI

/// `/yakit` — yakıt alım kayıtları + kayıt formu.
struct FuelView: View {
    @StateObject private var viewModel = FuelViewModel()
    @EnvironmentObject private var session: AppSession
    @State private var formGosteriliyor = false

    var body: some View {
        KBModuleScreen(
            title: NavDestination.yakit.label,
            icon: NavDestination.yakit.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.rows.isEmpty,
            emptyMessage: "Seçilen aralıkta yakıt kaydı yok.",
            newItemLabel: session.canManageOperations ? "Yeni Kayıt" : nil,
            onNewItem: session.canManageOperations ? { formGosteriliyor = true } : nil,
            onRefresh: { await viewModel.load() }
        ) {
            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    .listRowBackground(Color.clear)
            }

            Section("Tarih aralığı") {
                KBDateField(title: "Başlangıç", date: $viewModel.baslangic)
                KBDateField(title: "Bitiş", date: $viewModel.bitis)
            }

            Section("Alımlar (\(viewModel.total))") {
                ForEach(viewModel.rows) { row in
                    KBListRow(
                        title: row.plaka,
                        subtitle: yakitAltBaslik(row),
                        detail: yakitDetay(row),
                        badge: row.gunlukCalismadan ? "Mesai kaydı" : nil,
                        badgeTone: .info,
                        trailingValue: KBNumberFormat.para(row.tutar)
                    )
                    .task { await viewModel.loadMoreIfNeeded(current: row) }
                }
                if viewModel.isLoadingMore {
                    HStack { Spacer(); ProgressView(); Spacer() }
                }
            }
        }
        .onChange(of: viewModel.baslangic) { _, _ in Task { await viewModel.load() } }
        .onChange(of: viewModel.bitis) { _, _ in Task { await viewModel.load() } }
        .task { if viewModel.rows.isEmpty { await viewModel.load() } }
        .sheet(isPresented: $formGosteriliyor) {
            NavigationStack {
                FuelFormView { Task { await viewModel.load() } }
            }
        }
    }

    private func yakitAltBaslik(_ row: FuelRecordFullDTO) -> String {
        let tur = FuelKind(rawValue: row.yakitTuru)?.displayName ?? row.yakitTuru
        return "\(row.tarih.kbGun) · \(tur)"
    }

    private func yakitDetay(_ row: FuelRecordFullDTO) -> String {
        var parts = [
            KBNumberFormat.miktar(row.litre, birim: "lt"),
            "\(KBNumberFormat.para(row.birimFiyat))/lt",
        ]
        if let sayac = row.sayac { parts.append("Sayaç: \(KBNumberFormat.miktar(sayac))") }
        if let sorumlu = row.sorumluPersonelAdi { parts.append(sorumlu) }
        return parts.joined(separator: " · ")
    }
}

@MainActor
final class FuelViewModel: ObservableObject {
    @Published var rows: [FuelRecordFullDTO] = []
    @Published var baslangic: Date?
    @Published var bitis: Date?
    @Published private(set) var total = 0
    @Published private(set) var toplamLitre: Double = 0
    @Published private(set) var toplamTutar: Double = 0
    @Published private(set) var isLoading = false
    @Published private(set) var isLoadingMore = false
    @Published var errorMessage: String?

    private let api: APIClient
    private var page = PageRequest()
    private var hasMore = false
    let vehicleId: String?

    init(vehicleId: String? = nil, api: APIClient = .shared) {
        self.vehicleId = vehicleId
        self.api = api
    }

    /// Özet sunucudan gelir: sayfada görünmeyen kayıtlar da toplamlara dahildir.
    var ozet: [KBStat] {
        [
            KBStat(label: "Kayıt", value: "\(total)"),
            KBStat(label: "Toplam litre", value: KBNumberFormat.miktar(toplamLitre, birim: "lt")),
            KBStat(label: "Toplam tutar", value: KBNumberFormat.para(toplamTutar), tone: .accent),
        ]
    }

    func load() async {
        page = PageRequest()
        isLoading = true
        errorMessage = nil
        do {
            let response = try await api.fetchFuelPage(
                page: page,
                vehicleId: vehicleId,
                baslangic: baslangic,
                bitis: bitis
            )
            rows = response.items
            total = response.total
            toplamLitre = response.ozet.toplamLitre
            toplamTutar = response.ozet.toplamTutar
            hasMore = response.page * response.pageSize < response.total
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func loadMoreIfNeeded(current row: FuelRecordFullDTO) async {
        guard hasMore, !isLoadingMore, rows.last?.id == row.id else { return }
        isLoadingMore = true
        do {
            let next = page.next
            let response = try await api.fetchFuelPage(
                page: next,
                vehicleId: vehicleId,
                baslangic: baslangic,
                bitis: bitis
            )
            page = next
            rows.append(contentsOf: response.items)
            hasMore = response.page * response.pageSize < response.total
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoadingMore = false
    }
}

struct FuelFormView: View {
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = FuelFormModel()
    @ObservedObject private var lookups = LookupStore.shared

    var body: some View {
        Form {
            Section("Kayıt") {
                KBPickerField(
                    title: "Araç",
                    items: lookups.araclar,
                    selection: $form.vehicleId,
                    required: true,
                    placeholder: "Araç seçin",
                    error: form.hatalar["vehicleId"],
                    label: \.etiket
                )
                KBDateField(title: "Tarih", date: $form.tarih, required: true)
                KBEnumField(title: "Yakıt türü", selection: $form.yakitTuru)
            }

            Section("Miktar") {
                KBNumberField(
                    title: "Litre",
                    text: $form.litre,
                    required: true,
                    suffix: "lt",
                    error: form.hatalar["litre"]
                )
                KBNumberField(
                    title: "Birim fiyat",
                    text: $form.birimFiyat,
                    required: true,
                    suffix: "₺/lt",
                    error: form.hatalar["birimFiyat"]
                )
                KBDetailRow(label: "Tutar (hesaplanan)", value: form.tutarMetni)
                KBNumberField(
                    title: "Sayaç değeri",
                    text: $form.sayac,
                    error: form.hatalar["sayac"]
                )
            }

            Section("Sorumlu") {
                KBPickerField(
                    title: "Sorumlu personel",
                    items: lookups.personeller,
                    selection: $form.sorumluPersonelId,
                    label: \.etiket
                )
            }

            Section {
                KBFormActions(
                    saveTitle: "Yakıt Kaydını Ekle",
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
        .navigationTitle("Yeni Yakıt Kaydı")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .task { await lookups.loadIfNeeded() }
    }
}

@MainActor
final class FuelFormModel: ObservableObject {
    @Published var vehicleId: String?
    @Published var tarih: Date? = Date()
    @Published var yakitTuru: FuelKind = .MOTORIN
    @Published var litre = ""
    @Published var birimFiyat = ""
    @Published var sayac = ""
    @Published var sorumluPersonelId: String?

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(vehicleId: String? = nil, api: APIClient = .shared) {
        self.vehicleId = vehicleId
        self.api = api
    }

    /// Sunucu tutarı litre × birim fiyat olarak hesaplar; burada yalnız önizleme.
    var tutarMetni: String {
        guard let litre = KBNumberFormat.parse(litre),
              let fiyat = KBNumberFormat.parse(birimFiyat) else { return "—" }
        return KBNumberFormat.para(litre * fiyat)
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if vehicleId == nil { result["vehicleId"] = "Araç seçin" }
        if KBNumberFormat.parse(litre) == nil { result["litre"] = "Litre zorunlu" }
        if KBNumberFormat.parse(birimFiyat) == nil { result["birimFiyat"] = "Birim fiyat zorunlu" }
        if KBNumberFormat.isInvalid(sayac) { result["sayac"] = "Geçerli bir sayı girin" }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let vehicleId,
              let litreDeger = KBNumberFormat.parse(litre),
              let fiyatDeger = KBNumberFormat.parse(birimFiyat) else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createFuelRecord(
                FuelRequestDTO(
                    vehicleId: vehicleId,
                    tarih: tarih?.kbIsoGun,
                    yakitTuru: yakitTuru.rawValue,
                    litre: litreDeger,
                    birimFiyat: fiyatDeger,
                    sayac: KBNumberFormat.parse(sayac),
                    sorumluPersonelId: sorumluPersonelId,
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
