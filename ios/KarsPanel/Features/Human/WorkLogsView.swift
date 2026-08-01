import SwiftUI

/// `/gunluk-calisma` — personel mesai defteri ve araç çalışma defteri.
struct WorkLogsView: View {
    private enum Tab: String, CaseIterable, Identifiable {
        case personel
        case arac

        var id: String { rawValue }
        var label: String { self == .personel ? "Personel Mesai" : "Araç Çalışma" }
    }

    @StateObject private var viewModel = WorkLogsViewModel()
    @State private var tab: Tab = .personel
    @State private var personelFormu = false
    @State private var aracFormu = false

    var body: some View {
        KBModuleScreen(
            title: NavDestination.gunlukCalisma.label,
            icon: NavDestination.gunlukCalisma.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: tab == .personel
                ? viewModel.personelMesaileri.isEmpty
                : viewModel.aracCalismalari.isEmpty,
            emptyMessage: "Seçilen aralıkta kayıt yok.",
            newItemLabel: tab == .personel ? "Mesai Ekle" : "Çalışma Ekle",
            onNewItem: { tab == .personel ? (personelFormu = true) : (aracFormu = true) },
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
                KBStatRow(tiles: tab == .personel ? viewModel.personelOzet : viewModel.aracOzet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    .listRowBackground(Color.clear)
            }

            Section("Tarih aralığı") {
                KBDateField(title: "Başlangıç", date: $viewModel.baslangic)
                KBDateField(title: "Bitiş", date: $viewModel.bitis)
            }

            if tab == .personel {
                Section("Personel mesaileri (\(viewModel.personelTotal))") {
                    ForEach(viewModel.personelMesaileri) { row in
                        KBListRow(
                            title: row.personelAdi ?? "—",
                            subtitle: mesaiAltBaslik(row),
                            detail: mesaiDetay(row),
                            badge: WorkKind(rawValue: row.calismaTipi)?.displayName
                                ?? row.calismaTipi,
                            badgeTone: row.mesaiSaat > 0 ? .warning : .neutral,
                            trailingValue: KBNumberFormat.miktar(row.toplamSaat, birim: "sa")
                        )
                    }
                }
            } else {
                Section("Araç çalışmaları (\(viewModel.aracTotal))") {
                    ForEach(viewModel.aracCalismalari) { row in
                        KBListRow(
                            title: row.plaka,
                            subtitle: aracAltBaslik(row),
                            detail: aracDetay(row),
                            trailingValue: KBNumberFormat.miktar(row.calismaSaati, birim: "sa")
                        )
                    }
                }
            }
        }
        .onChange(of: viewModel.baslangic) { _, _ in Task { await viewModel.load() } }
        .onChange(of: viewModel.bitis) { _, _ in Task { await viewModel.load() } }
        .task { if viewModel.personelMesaileri.isEmpty { await viewModel.load() } }
        .sheet(isPresented: $personelFormu) {
            NavigationStack {
                PersonnelWorkLogFormView { Task { await viewModel.load() } }
            }
        }
        .sheet(isPresented: $aracFormu) {
            NavigationStack {
                VehicleWorkLogFormView { Task { await viewModel.load() } }
            }
        }
    }

    private func mesaiAltBaslik(_ row: PersonnelWorkLogDTO) -> String {
        [row.tarih.kbGun, row.unvan].compactMap { $0 }.joined(separator: " · ")
    }

    private func mesaiDetay(_ row: PersonnelWorkLogDTO) -> String {
        var parts = [
            "\(row.girisSaati) – \(row.cikisSaati)",
            "Normal \(KBNumberFormat.miktar(row.normalSaat, birim: "sa"))",
            "Mesai \(KBNumberFormat.miktar(row.mesaiSaat, birim: "sa"))",
        ]
        if let birim = row.gorevlendirilenBirim { parts.append(birim) }
        if let is_ = row.yapilanIs, !is_.isEmpty { parts.append(is_) }
        return parts.joined(separator: " · ")
    }

    private func aracAltBaslik(_ row: VehicleWorkLogDTO) -> String {
        [row.tarih.kbGun, row.soforAdi].compactMap { $0 }.joined(separator: " · ")
    }

    private func aracDetay(_ row: VehicleWorkLogDTO) -> String {
        var parts = ["\(row.girisSaati) – \(row.cikisSaati)"]
        if let gorev = row.gorevTanimi { parts.append(gorev) }
        if let yer = row.yerBolge { parts.append(yer) }
        if let litre = row.yakitLitre {
            parts.append(KBNumberFormat.miktar(litre, birim: "lt"))
        }
        if let tutar = row.yakitTutari { parts.append(KBNumberFormat.para(tutar)) }
        return parts.joined(separator: " · ")
    }
}

@MainActor
final class WorkLogsViewModel: ObservableObject {
    @Published private(set) var personelMesaileri: [PersonnelWorkLogDTO] = []
    @Published private(set) var aracCalismalari: [VehicleWorkLogDTO] = []
    @Published var baslangic: Date?
    @Published var bitis: Date?
    @Published private(set) var personelTotal = 0
    @Published private(set) var aracTotal = 0
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var personelOzet: [KBStat] {
        [
            KBStat(label: "Kayıt", value: "\(personelTotal)"),
            KBStat(
                label: "Görünen toplam saat",
                value: KBNumberFormat.miktar(
                    personelMesaileri.map(\.toplamSaat).reduce(0, +),
                    birim: "sa"
                )
            ),
            KBStat(
                label: "Fazla mesai",
                value: KBNumberFormat.miktar(
                    personelMesaileri.map(\.mesaiSaat).reduce(0, +),
                    birim: "sa"
                ),
                tone: .warning
            ),
        ]
    }

    var aracOzet: [KBStat] {
        [
            KBStat(label: "Kayıt", value: "\(aracTotal)"),
            KBStat(
                label: "Görünen çalışma",
                value: KBNumberFormat.miktar(
                    aracCalismalari.map(\.calismaSaati).reduce(0, +),
                    birim: "sa"
                )
            ),
            KBStat(
                label: "Yakıt tutarı",
                value: KBNumberFormat.para(
                    aracCalismalari.compactMap(\.yakitTutari).reduce(0, +)
                ),
                tone: .accent
            ),
        ]
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await api.fetchWorkLogsOverview(
                baslangic: baslangic,
                bitis: bitis
            )
            personelMesaileri = response.personelMesaileri.items
            personelTotal = response.personelMesaileri.total
            aracCalismalari = response.aracCalismalari.items
            aracTotal = response.aracCalismalari.total
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }
}

// MARK: - Personel mesai formu

struct PersonnelWorkLogFormView: View {
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = PersonnelWorkLogFormModel()
    @ObservedObject private var lookups = LookupStore.shared

    var body: some View {
        Form {
            Section("Personel") {
                KBPickerField(
                    title: "Personel",
                    items: lookups.personeller,
                    selection: $form.personnelId,
                    required: true,
                    placeholder: "Personel seçin",
                    error: form.hatalar["personnelId"],
                    label: \.etiket
                )
                KBDateField(title: "Tarih", date: $form.tarih, required: true)
                KBEnumField(title: "Çalışma tipi", selection: $form.calismaTipi)
            }

            Section("Saatler") {
                KBTimeField(title: "Giriş saati", value: $form.girisSaati)
                KBTimeField(title: "Çıkış saati", value: $form.cikisSaati)
                KBDetailRow(label: "Toplam (hesaplanan)", value: form.toplamMetni)
            }

            Section("Detay") {
                KBPickerField(
                    title: "Görevlendirilen birim",
                    items: lookups.mudurlukler,
                    selection: $form.gorevlendirilenBirimId,
                    label: { $0.name ?? "—" }
                )
                KBTextField(title: "Yapılan iş", text: $form.yapilanIs, multiline: true)
                KBTextField(title: "Notlar", text: $form.notlar, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Mesaiyi Kaydet",
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
        .navigationTitle("Personel Mesaisi")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .task { await lookups.loadIfNeeded() }
    }
}

@MainActor
final class PersonnelWorkLogFormModel: ObservableObject {
    @Published var personnelId: String?
    @Published var tarih: Date? = Date()
    @Published var girisSaati = "08:00"
    @Published var cikisSaati = "17:00"
    @Published var calismaTipi: WorkKind = .NORMAL_MESAI
    @Published var yapilanIs = ""
    @Published var gorevlendirilenBirimId: String?
    @Published var notlar = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Sunucu Excel formülleriyle hesaplar; buradaki değer yalnızca önizleme.
    var toplamMetni: String {
        guard let normal = WorkHourMath.normalSaat(giris: girisSaati, cikis: cikisSaati),
              let mesai = WorkHourMath.mesaiSaat(cikis: cikisSaati) else { return "—" }
        return KBNumberFormat.miktar(normal + mesai, birim: "sa")
            + " (normal \(KBNumberFormat.miktar(normal, birim: "sa")),"
            + " mesai \(KBNumberFormat.miktar(mesai, birim: "sa")))"
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if personnelId == nil { result["personnelId"] = "Personel seçin" }
        if !WorkHourMath.isValidTime(girisSaati) || !WorkHourMath.isValidTime(cikisSaati) {
            result["saat"] = "Saatleri SS:dd biçiminde girin"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let personnelId, let tarih, isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createPersonnelWorkLog(
                PersonnelWorkLogRequestDTO(
                    personnelId: personnelId,
                    tarih: tarih.kbIsoGun,
                    girisSaati: girisSaati,
                    cikisSaati: cikisSaati,
                    calismaTipi: calismaTipi.rawValue,
                    yapilanIs: yapilanIs.bosDegilse,
                    gorevlendirilenBirimId: gorevlendirilenBirimId,
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

// MARK: - Araç çalışma formu

struct VehicleWorkLogFormView: View {
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = VehicleWorkLogFormModel()
    @ObservedObject private var lookups = LookupStore.shared

    var body: some View {
        Form {
            Section("Araç") {
                KBPickerField(
                    title: "Araç",
                    items: lookups.araclar,
                    selection: $form.vehicleId,
                    required: true,
                    placeholder: "Araç seçin",
                    error: form.hatalar["vehicleId"],
                    label: \.etiket
                )
                KBPickerField(
                    title: "Şoför",
                    items: lookups.soforler,
                    selection: $form.driverId,
                    label: { $0.name ?? "—" }
                )
                KBDateField(title: "Tarih", date: $form.tarih, required: true)
            }

            Section("Saatler") {
                KBTimeField(title: "Giriş saati", value: $form.girisSaati)
                KBTimeField(title: "Çıkış saati", value: $form.cikisSaati)
                KBDetailRow(label: "Çalışma (hesaplanan)", value: form.calismaMetni)
            }

            Section("Görev") {
                KBTextField(title: "Görev tanımı", text: $form.gorevTanimi)
                KBTextField(title: "Yer / bölge", text: $form.yerBolge)
            }

            Section("Yakıt") {
                KBNumberField(
                    title: "Yakıt litre",
                    text: $form.yakitLitre,
                    suffix: "lt",
                    error: form.hatalar["yakitLitre"]
                )
                KBNumberField(
                    title: "Birim fiyat",
                    text: $form.birimFiyat,
                    suffix: "₺/lt",
                    error: form.hatalar["birimFiyat"]
                )
                KBEnumField(title: "Yakıt türü", selection: $form.yakitTuru)
                Text("Yakıt girildiğinde araca ayrıca yakıt alım kaydı oluşturulur.")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            }

            Section("Notlar") {
                KBTextField(title: "Notlar", text: $form.notlar, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Çalışmayı Kaydet",
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
        .navigationTitle("Araç Çalışması")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .task { await lookups.loadIfNeeded() }
    }
}

@MainActor
final class VehicleWorkLogFormModel: ObservableObject {
    @Published var vehicleId: String?
    @Published var driverId: String?
    @Published var tarih: Date? = Date()
    @Published var girisSaati = "08:00"
    @Published var cikisSaati = "17:00"
    @Published var gorevTanimi = ""
    @Published var yerBolge = ""
    @Published var yakitLitre = ""
    @Published var birimFiyat = ""
    @Published var yakitTuru: FuelKind = .MOTORIN
    @Published var notlar = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Gece devri desteklenir: 22:00–06:00 → 8 saat.
    var calismaMetni: String {
        guard let saat = WorkHourMath.aracCalismaSaati(giris: girisSaati, cikis: cikisSaati) else {
            return "—"
        }
        return KBNumberFormat.miktar(saat, birim: "sa")
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if vehicleId == nil { result["vehicleId"] = "Araç seçin" }
        if !WorkHourMath.isValidTime(girisSaati) || !WorkHourMath.isValidTime(cikisSaati) {
            result["saat"] = "Saatleri SS:dd biçiminde girin"
        }
        for (key, value) in [("yakitLitre", yakitLitre), ("birimFiyat", birimFiyat)]
        where KBNumberFormat.isInvalid(value) {
            result[key] = "Geçerli bir sayı girin"
        }
        if KBNumberFormat.parse(yakitLitre) != nil, KBNumberFormat.parse(birimFiyat) == nil {
            result["birimFiyat"] = "Litre girildiyse birim fiyat da gerekir"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let vehicleId, let tarih, isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createVehicleWorkLog(
                VehicleWorkLogRequestDTO(
                    vehicleId: vehicleId,
                    tarih: tarih.kbIsoGun,
                    girisSaati: girisSaati,
                    cikisSaati: cikisSaati,
                    driverId: driverId,
                    soforAdi: nil,
                    gorevTanimi: gorevTanimi.bosDegilse,
                    yerBolge: yerBolge.bosDegilse,
                    yakitLitre: KBNumberFormat.parse(yakitLitre),
                    yakitTuru: KBNumberFormat.parse(yakitLitre) == nil ? nil : yakitTuru.rawValue,
                    birimFiyat: KBNumberFormat.parse(birimFiyat),
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
