import SwiftUI

/// `/beton` — reçeteler, üretim kayıtları ve stok durumu.
struct ConcreteView: View {
    private enum Tab: String, CaseIterable, Identifiable {
        case recete
        case uretim
        case stok

        var id: String { rawValue }
        var label: String {
            switch self {
            case .recete: return "Reçeteler"
            case .uretim: return "Üretim"
            case .stok: return "Stok"
            }
        }
    }

    @StateObject private var viewModel = ConcreteViewModel()
    @EnvironmentObject private var session: AppSession
    @State private var tab: Tab = .recete
    @State private var uretimFormu = false
    @State private var stokFormu = false
    @State private var duzenlenenRecete: ConcreteRecipeFullDTO?

    var body: some View {
        KBModuleScreen(
            title: NavDestination.beton.label,
            icon: NavDestination.beton.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.data == nil,
            emptyMessage: "Beton verisi bulunamadı.",
            newItemLabel: yeniEtiket,
            onNewItem: yeniAksiyon,
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

            if let data = viewModel.data {
                switch tab {
                case .recete:
                    Section("Reçeteler (1 m³ için)") {
                        ForEach(data.receteler) { recete in
                            Button {
                                guard session.canManageOperations else { return }
                                duzenlenenRecete = recete
                            } label: {
                                KBListRow(
                                    title: recete.sinif,
                                    subtitle: receteAltBaslik(recete),
                                    detail: receteDetay(recete),
                                    badge: yogunlukEtiketi(recete.yogunlukDurumu),
                                    badgeTone: StatusTone.forStock(recete.yogunlukDurumu).badge,
                                    trailingValue: String(
                                        format: "S/Ç %.2f",
                                        recete.suCimentoOrani
                                    )
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                case .uretim:
                    Section("Üretim kayıtları") {
                        if data.uretimler.isEmpty {
                            Text("Kayıt yok").font(.subheadline).foregroundStyle(KBTheme.muted)
                        } else {
                            ForEach(data.uretimler) { uretim in
                                KBListRow(
                                    title: uretim.sinif,
                                    subtitle: uretim.tarih.kbGun,
                                    detail: uretimDetay(uretim),
                                    trailingValue: KBNumberFormat.miktar(
                                        uretim.hedefM3,
                                        birim: "m³"
                                    )
                                )
                            }
                        }
                    }
                case .stok:
                    Section("Stok durumu") {
                        ForEach(data.stoklar) { stok in
                            KBListRow(
                                title: stok.malzeme,
                                subtitle: "Başlangıç "
                                    + KBNumberFormat.miktar(stok.baslangicStok, birim: stok.birim),
                                detail: "Giriş \(KBNumberFormat.miktar(stok.toplamGiris))"
                                    + " · Çıkış \(KBNumberFormat.miktar(stok.toplamCikis))"
                                    + " · Kritik \(KBNumberFormat.miktar(stok.kritikSeviye))",
                                badge: stok.durum,
                                badgeTone: StatusTone.forStock(stok.durum).badge,
                                trailingValue: KBNumberFormat.miktar(
                                    stok.kalanStok,
                                    birim: stok.birim
                                )
                            )
                        }
                    }
                }
            }
        }
        .task { if viewModel.data == nil { await viewModel.load() } }
        .sheet(isPresented: $uretimFormu) {
            NavigationStack {
                ConcreteProductionFormView(receteler: viewModel.data?.receteler ?? []) {
                    Task { await viewModel.load() }
                }
            }
        }
        .sheet(isPresented: $stokFormu) {
            NavigationStack {
                ConcreteStockFormView(stoklar: viewModel.data?.stoklar ?? []) {
                    Task { await viewModel.load() }
                }
            }
        }
        .sheet(item: $duzenlenenRecete) { recete in
            NavigationStack {
                ConcreteRecipeFormView(recete: recete) { Task { await viewModel.load() } }
            }
        }
    }

    private var yeniEtiket: String? {
        guard session.canManageOperations else { return nil }
        switch tab {
        case .recete: return nil
        case .uretim: return "Üretim Ekle"
        case .stok: return "Stok Girişi"
        }
    }

    private var yeniAksiyon: (() -> Void)? {
        guard session.canManageOperations else { return nil }
        switch tab {
        case .recete: return nil
        case .uretim: return { uretimFormu = true }
        case .stok: return { stokFormu = true }
        }
    }

    private func receteAltBaslik(_ r: ConcreteRecipeFullDTO) -> String {
        "Çimento \(KBNumberFormat.miktar(r.cimentoKg, birim: "kg"))"
            + " · Su \(KBNumberFormat.miktar(r.suLt, birim: "lt"))"
            + " · Katkı \(KBNumberFormat.miktar(r.katkiKg, birim: "kg"))"
    }

    private func receteDetay(_ r: ConcreteRecipeFullDTO) -> String {
        "Kum \(KBNumberFormat.miktar(r.kumKg))"
            + " · 0–5 \(KBNumberFormat.miktar(r.micir05Kg))"
            + " · 5–12 \(KBNumberFormat.miktar(r.micir512Kg))"
            + " · 12–19 \(KBNumberFormat.miktar(r.micir1219Kg))"
            + " · Toplam \(KBNumberFormat.miktar(r.toplamKarisimKg, birim: "kg"))"
    }

    private func uretimDetay(_ u: ConcreteProductionDTO) -> String {
        var parts = [
            "Çimento \(KBNumberFormat.miktar(u.cimentoKg, birim: "kg"))",
            "Kum \(KBNumberFormat.miktar(u.kumKg, birim: "kg"))",
            "Su \(KBNumberFormat.miktar(u.suLt, birim: "lt"))",
        ]
        if let notlar = u.notlar, !notlar.isEmpty { parts.append(notlar) }
        return parts.joined(separator: " · ")
    }

    private func yogunlukEtiketi(_ durum: String) -> String {
        switch durum {
        case "NORMAL": return "Yoğunluk normal"
        case "DUSUK": return "Yoğunluk düşük"
        case "YUKSEK": return "Yoğunluk yüksek"
        default: return durum
        }
    }
}

@MainActor
final class ConcreteViewModel: ObservableObject {
    @Published private(set) var data: ConcreteResponseDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var ozet: [KBStat] {
        guard let data else { return [] }
        let kritik = data.stoklar.filter { $0.durum == "KRITIK" }.count
        return [
            KBStat(
                label: "Toplam üretim",
                value: KBNumberFormat.miktar(data.ozet.toplamUretimM3, birim: "m³"),
                tone: .accent
            ),
            KBStat(label: "Üretim kaydı", value: "\(data.ozet.uretimSayisi)"),
            KBStat(label: "Aktif reçete", value: "\(data.receteler.filter(\.aktif).count)"),
            KBStat(
                label: "Kritik stok",
                value: "\(kritik)",
                tone: kritik > 0 ? .danger : .success
            ),
        ]
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            data = try await api.fetchConcreteOverview()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }
}

// MARK: - Üretim formu

struct ConcreteProductionFormView: View {
    let receteler: [ConcreteRecipeFullDTO]
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = ConcreteProductionFormModel()

    private var secilen: ConcreteRecipeFullDTO? {
        receteler.first { $0.id == form.recipeId }
    }

    var body: some View {
        Form {
            Section("Üretim") {
                KBPickerField(
                    title: "Reçete",
                    items: receteler.filter(\.aktif),
                    selection: $form.recipeId,
                    required: true,
                    placeholder: "Reçete seçin",
                    error: form.hatalar["recipeId"],
                    label: \.sinif
                )
                KBDateField(title: "Tarih", date: $form.tarih, required: true)
                KBNumberField(
                    title: "Hedef üretim",
                    text: $form.hedefM3,
                    required: true,
                    suffix: "m³",
                    error: form.hatalar["hedefM3"]
                )
                KBTextField(title: "Notlar", text: $form.notlar, multiline: true)
            }

            if let recete = secilen, let m3 = KBNumberFormat.parse(form.hedefM3), m3 > 0 {
                Section("Hesaplanan malzeme ihtiyacı") {
                    KBDetailRow(
                        label: "Çimento",
                        value: KBNumberFormat.miktar(recete.cimentoKg * m3, birim: "kg")
                    )
                    KBDetailRow(
                        label: "Kum",
                        value: KBNumberFormat.miktar(recete.kumKg * m3, birim: "kg")
                    )
                    KBDetailRow(
                        label: "Mıcır 0–5",
                        value: KBNumberFormat.miktar(recete.micir05Kg * m3, birim: "kg")
                    )
                    KBDetailRow(
                        label: "Mıcır 5–12",
                        value: KBNumberFormat.miktar(recete.micir512Kg * m3, birim: "kg")
                    )
                    KBDetailRow(
                        label: "Mıcır 12–19",
                        value: KBNumberFormat.miktar(recete.micir1219Kg * m3, birim: "kg")
                    )
                    KBDetailRow(
                        label: "Su",
                        value: KBNumberFormat.miktar(recete.suLt * m3, birim: "lt")
                    )
                    KBDetailRow(
                        label: "Katkı",
                        value: KBNumberFormat.miktar(recete.katkiKg * m3, birim: "kg")
                    )
                }
            }

            Section {
                KBFormActions(
                    saveTitle: "Üretimi Kaydet",
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
        .navigationTitle("Beton Üretimi")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class ConcreteProductionFormModel: ObservableObject {
    @Published var recipeId: String?
    @Published var tarih: Date? = Date()
    @Published var hedefM3 = ""
    @Published var notlar = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if recipeId == nil { result["recipeId"] = "Reçete seçin" }
        if let m3 = KBNumberFormat.parse(hedefM3) {
            if m3 <= 0 { result["hedefM3"] = "Sıfırdan büyük olmalı" }
        } else {
            result["hedefM3"] = "Hedef m³ zorunlu"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let recipeId, let tarih, let m3 = KBNumberFormat.parse(hedefM3), isValid else {
            return false
        }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createConcreteProduction(
                ConcreteProductionRequestDTO(
                    recipeId: recipeId,
                    tarih: tarih.kbIsoGun,
                    hedefM3: m3,
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

// MARK: - Stok giriş formu

struct ConcreteStockFormView: View {
    let stoklar: [ConcreteStockDTO]
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = ConcreteStockFormModel()

    private var secilen: ConcreteStockDTO? {
        stoklar.first { $0.malzeme == form.malzeme }
    }

    var body: some View {
        Form {
            Section("Stok girişi") {
                KBPickerField(
                    title: "Malzeme",
                    items: stoklar,
                    selection: $form.malzeme,
                    required: true,
                    placeholder: "Malzeme seçin",
                    error: form.hatalar["malzeme"],
                    label: \.malzeme
                )
                KBNumberField(
                    title: "Giriş miktarı",
                    text: $form.miktar,
                    required: true,
                    suffix: secilen?.birim,
                    error: form.hatalar["miktar"]
                )
                if let secilen {
                    KBDetailRow(
                        label: "Mevcut kalan",
                        value: KBNumberFormat.miktar(secilen.kalanStok, birim: secilen.birim)
                    )
                }
            }

            Section {
                KBFormActions(
                    saveTitle: "Stok Girişini Kaydet",
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
        .navigationTitle("Beton Stok Girişi")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class ConcreteStockFormModel: ObservableObject {
    /// `ConcreteStockDTO.id` malzeme adının kendisidir.
    @Published var malzeme: String?
    @Published var miktar = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if malzeme == nil { result["malzeme"] = "Malzeme seçin" }
        if let deger = KBNumberFormat.parse(miktar) {
            if deger <= 0 { result["miktar"] = "Sıfırdan büyük olmalı" }
        } else {
            result["miktar"] = "Miktar zorunlu"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let malzeme, let deger = KBNumberFormat.parse(miktar), isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.addConcreteStock(
                ConcreteStockRequestDTO(malzeme: malzeme, miktar: deger)
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

// MARK: - Reçete düzenleme

struct ConcreteRecipeFormView: View {
    let recete: ConcreteRecipeFullDTO
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form: ConcreteRecipeFormModel

    init(recete: ConcreteRecipeFullDTO, onSaved: @escaping () -> Void) {
        self.recete = recete
        self.onSaved = onSaved
        _form = StateObject(wrappedValue: ConcreteRecipeFormModel(recete: recete))
    }

    var body: some View {
        Form {
            Section("1 m³ için karışım") {
                KBNumberField(
                    title: "Çimento",
                    text: $form.cimentoKg,
                    required: true,
                    suffix: "kg",
                    error: form.hatalar["cimentoKg"]
                )
                KBNumberField(
                    title: "Kum",
                    text: $form.kumKg,
                    required: true,
                    suffix: "kg",
                    error: form.hatalar["kumKg"]
                )
                KBNumberField(
                    title: "Mıcır 0–5",
                    text: $form.micir05Kg,
                    required: true,
                    suffix: "kg",
                    error: form.hatalar["micir05Kg"]
                )
                KBNumberField(
                    title: "Mıcır 5–12",
                    text: $form.micir512Kg,
                    required: true,
                    suffix: "kg",
                    error: form.hatalar["micir512Kg"]
                )
                KBNumberField(
                    title: "Mıcır 12–19",
                    text: $form.micir1219Kg,
                    required: true,
                    suffix: "kg",
                    error: form.hatalar["micir1219Kg"]
                )
                KBNumberField(
                    title: "Su",
                    text: $form.suLt,
                    required: true,
                    suffix: "lt",
                    error: form.hatalar["suLt"]
                )
                KBNumberField(
                    title: "Katkı",
                    text: $form.katkiKg,
                    required: true,
                    suffix: "kg",
                    error: form.hatalar["katkiKg"]
                )
            }

            Section("Hesaplanan") {
                KBDetailRow(label: "Su / çimento oranı", value: form.suCimentoMetni)
                KBDetailRow(label: "Toplam agrega", value: form.toplamAgregaMetni)
                KBDetailRow(label: "Toplam karışım", value: form.toplamKarisimMetni)
            }

            Section("Açıklama") {
                KBTextField(title: "Açıklama", text: $form.aciklama, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Reçeteyi Güncelle",
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
        .navigationTitle(recete.sinif)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class ConcreteRecipeFormModel: ObservableObject {
    @Published var cimentoKg: String
    @Published var kumKg: String
    @Published var micir05Kg: String
    @Published var micir512Kg: String
    @Published var micir1219Kg: String
    @Published var suLt: String
    @Published var katkiKg: String
    @Published var aciklama: String

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient
    private let recipeId: String

    init(recete: ConcreteRecipeFullDTO, api: APIClient = .shared) {
        self.api = api
        recipeId = recete.id
        cimentoKg = KBNumberFormat.text(recete.cimentoKg)
        kumKg = KBNumberFormat.text(recete.kumKg)
        micir05Kg = KBNumberFormat.text(recete.micir05Kg)
        micir512Kg = KBNumberFormat.text(recete.micir512Kg)
        micir1219Kg = KBNumberFormat.text(recete.micir1219Kg)
        suLt = KBNumberFormat.text(recete.suLt)
        katkiKg = KBNumberFormat.text(recete.katkiKg)
        aciklama = recete.aciklama ?? ""
    }

    private var alanlar: [(String, String)] {
        [
            ("cimentoKg", cimentoKg),
            ("kumKg", kumKg),
            ("micir05Kg", micir05Kg),
            ("micir512Kg", micir512Kg),
            ("micir1219Kg", micir1219Kg),
            ("suLt", suLt),
            ("katkiKg", katkiKg),
        ]
    }

    var suCimentoMetni: String {
        guard let su = KBNumberFormat.parse(suLt),
              let cimento = KBNumberFormat.parse(cimentoKg),
              cimento > 0 else { return "—" }
        return String(format: "%.3f", su / cimento)
    }

    var toplamAgregaMetni: String {
        let toplam = [kumKg, micir05Kg, micir512Kg, micir1219Kg]
            .compactMap(KBNumberFormat.parse)
            .reduce(0, +)
        return KBNumberFormat.miktar(toplam, birim: "kg")
    }

    var toplamKarisimMetni: String {
        let toplam = alanlar.map(\.1).compactMap(KBNumberFormat.parse).reduce(0, +)
        return KBNumberFormat.miktar(toplam, birim: "kg")
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        for (key, value) in alanlar {
            guard let sayi = KBNumberFormat.parse(value) else {
                result[key] = "Zorunlu"
                continue
            }
            if sayi < 0 { result[key] = "Negatif olamaz" }
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard isValid,
              let cimento = KBNumberFormat.parse(cimentoKg),
              let kum = KBNumberFormat.parse(kumKg),
              let m05 = KBNumberFormat.parse(micir05Kg),
              let m512 = KBNumberFormat.parse(micir512Kg),
              let m1219 = KBNumberFormat.parse(micir1219Kg),
              let su = KBNumberFormat.parse(suLt),
              let katki = KBNumberFormat.parse(katkiKg) else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.updateConcreteRecipe(
                id: recipeId,
                body: ConcreteRecipeRequestDTO(
                    cimentoKg: cimento,
                    kumKg: kum,
                    micir05Kg: m05,
                    micir512Kg: m512,
                    micir1219Kg: m1219,
                    suLt: su,
                    katkiKg: katki,
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
