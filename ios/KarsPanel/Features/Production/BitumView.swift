import SwiftUI

/// `/bitum` — depo doluluk durumu, hareket geçmişi ve maliyet ayarları.
struct BitumTrackingView: View {
    private enum Tab: String, CaseIterable, Identifiable {
        case depo
        case hareket
        case ayar

        var id: String { rawValue }
        var label: String {
            switch self {
            case .depo: return "Depolar"
            case .hareket: return "Hareketler"
            case .ayar: return "Ayarlar"
            }
        }
    }

    @StateObject private var viewModel = BitumViewModel()
    @EnvironmentObject private var session: AppSession
    @State private var tab: Tab = .depo
    @State private var hareketFormu = false

    var body: some View {
        KBModuleScreen(
            title: NavDestination.bitum.label,
            icon: NavDestination.bitum.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.data == nil,
            emptyMessage: "Bitüm verisi bulunamadı.",
            newItemLabel: session.canManageOperations && tab != .ayar ? "Yeni Hareket" : nil,
            onNewItem: session.canManageOperations && tab != .ayar
                ? { hareketFormu = true }
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

            if let data = viewModel.data {
                switch tab {
                case .depo:
                    Section("Depo durumu") {
                        ForEach(data.depolar) { depo in
                            VStack(alignment: .leading, spacing: 8) {
                                KBListRow(
                                    title: depo.ad,
                                    subtitle: depoTipi(depo.tip),
                                    detail: "Kapasite "
                                        + KBNumberFormat.miktar(depo.kapasite, birim: "ton"),
                                    badge: depoDurumu(depo.durum),
                                    badgeTone: depoTonu(depo.durum).badge,
                                    trailingValue: KBNumberFormat.miktar(
                                        depo.stokTon,
                                        birim: "ton"
                                    )
                                )
                                ProgressView(value: min(max(depo.dolulukOrani, 0), 1)) {
                                    Text("Doluluk %\(Int((depo.dolulukOrani * 100).rounded()))")
                                        .font(.caption)
                                        .foregroundStyle(KBTheme.muted)
                                }
                                .tint(depoTonu(depo.durum).progressColor)
                            }
                        }
                    }
                case .hareket:
                    Section("Hareket filtresi") {
                        Picker("Tip", selection: $viewModel.tipFiltre) {
                            Text("Tümü").tag(BitumMovementKind?.none)
                            ForEach(BitumMovementKind.allCases) {
                                Text($0.displayName).tag(Optional($0))
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    Section("Hareketler (\(data.total))") {
                        if data.items.isEmpty {
                            Text("Kayıt yok").font(.subheadline).foregroundStyle(KBTheme.muted)
                        } else {
                            ForEach(data.items) { hareket in
                                KBListRow(
                                    title: hareketBasligi(hareket),
                                    subtitle: hareket.tarih.kbGun,
                                    detail: hareketDetay(hareket),
                                    badge: BitumMovementKind(rawValue: hareket.tip)?.displayName
                                        ?? hareket.tip,
                                    badgeTone: hareketTonu(hareket.tip).badge,
                                    trailingValue: KBNumberFormat.miktar(
                                        hareket.miktarTon,
                                        birim: "ton"
                                    )
                                )
                            }
                        }
                    }
                case .ayar:
                    ayarIcerigi
                }
            }
        }
        .onChange(of: viewModel.tipFiltre) { _, _ in Task { await viewModel.load() } }
        .task { if viewModel.data == nil { await viewModel.load() } }
        .sheet(isPresented: $hareketFormu) {
            NavigationStack {
                BitumMovementFormView(
                    depolar: viewModel.data?.depolar ?? [],
                    ayarlar: viewModel.data?.ayarlar
                ) { Task { await viewModel.load() } }
            }
        }
    }

    @ViewBuilder
    private var ayarIcerigi: some View {
        Section("Depo ve taşıma") {
            KBNumberField(
                title: "Depo kapasitesi",
                text: $viewModel.depoKapasitesiTon,
                suffix: "ton"
            )
            KBNumberField(title: "Mesafe", text: $viewModel.mesafeKm, suffix: "km")
            KBNumberField(title: "TIR kapasitesi", text: $viewModel.tirKapasiteTon, suffix: "ton")
            KBNumberField(title: "Yakıt maliyeti", text: $viewModel.yakitTlKm, suffix: "₺/km")
            KBNumberField(
                title: "Referans alış fiyatı",
                text: $viewModel.referansAlisFiyat,
                suffix: "₺/ton"
            )
        }

        Section("Hesaplanan") {
            KBDetailRow(
                label: "Sefer maliyeti",
                value: KBNumberFormat.para(viewModel.seferMaliyeti)
            )
            KBDetailRow(
                label: "Ton taşıma maliyeti",
                value: KBNumberFormat.para(viewModel.tonTasima)
            )
        }

        Section("Uyarı eşikleri") {
            KBNumberField(title: "Kritik eşik (0–1)", text: $viewModel.kritikEsik)
            KBNumberField(title: "Düşük eşik (0–1)", text: $viewModel.dusukEsik)
        }

        if session.canManageOperations {
            Section {
                KBFormActions(
                    saveTitle: "Ayarları Kaydet",
                    isSaving: viewModel.isSaving,
                    isEnabled: viewModel.ayarlarValid,
                    errorMessage: viewModel.saveError
                ) {
                    Task { await viewModel.saveSettings() }
                }
            }
        }
    }

    private func depoTipi(_ tip: String) -> String {
        switch tip {
        case "ANA": return "Ana depo"
        case "SANTIYE": return "Şantiye deposu"
        case "MOBIL": return "Mobil tank"
        default: return tip
        }
    }

    private func depoDurumu(_ durum: String) -> String {
        switch durum {
        case "KRITIK": return "Kritik"
        case "DUSUK": return "Düşük"
        case "NORMAL": return "Normal"
        default: return durum
        }
    }

    private func depoTonu(_ durum: String) -> StatusBadgeTone {
        switch durum {
        case "KRITIK": return .danger
        case "DUSUK": return .warning
        default: return .success
        }
    }

    private func hareketTonu(_ tip: String) -> StatusBadgeTone {
        switch BitumMovementKind(rawValue: tip) {
        case .ALIS: return .success
        case .TASIMA: return .info
        case .KULLANIM: return .warning
        case nil: return .neutral
        }
    }

    private func hareketBasligi(_ h: BitumMovementDTO) -> String {
        switch BitumMovementKind(rawValue: h.tip) {
        case .ALIS:
            return h.depoAdi ?? "Alış"
        case .TASIMA:
            return "\(h.kaynakDepoAdi ?? "—") → \(h.hedefDepoAdi ?? "—")"
        case .KULLANIM:
            return h.kullanimDepoAdi ?? h.depoAdi ?? "Kullanım"
        case nil:
            return h.depoAdi ?? "—"
        }
    }

    private func hareketDetay(_ h: BitumMovementDTO) -> String {
        var parts: [String] = []
        if let fiyat = h.alisFiyati { parts.append("Alış \(KBNumberFormat.para(fiyat))/ton") }
        if let sefer = h.tirSeferSayisi { parts.append("\(sefer) sefer") }
        if let tasima = h.tasimaMaliyeti {
            parts.append("Taşıma \(KBNumberFormat.para(tasima))")
        }
        if let varis = h.varisMaliyetiTon {
            parts.append("Varış \(KBNumberFormat.para(varis))/ton")
        }
        if let toplam = h.toplamMaliyet {
            parts.append("Toplam \(KBNumberFormat.para(toplam))")
        }
        if let aciklama = h.aciklama, !aciklama.isEmpty { parts.append(aciklama) }
        return parts.joined(separator: " · ")
    }
}

@MainActor
final class BitumViewModel: ObservableObject {
    @Published private(set) var data: BitumResponseDTO?
    @Published var tipFiltre: BitumMovementKind?

    @Published var depoKapasitesiTon = ""
    @Published var mesafeKm = ""
    @Published var tirKapasiteTon = ""
    @Published var yakitTlKm = ""
    @Published var referansAlisFiyat = ""
    @Published var kritikEsik = ""
    @Published var dusukEsik = ""

    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?
    @Published var saveError: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var seferMaliyeti: Double {
        BitumMath.seferMaliyeti(
            mesafeKm: KBNumberFormat.parse(mesafeKm) ?? 0,
            yakitTlKm: KBNumberFormat.parse(yakitTlKm) ?? 0
        )
    }

    var tonTasima: Double {
        BitumMath.tonTasima(
            seferTl: seferMaliyeti,
            tirKapasiteTon: KBNumberFormat.parse(tirKapasiteTon) ?? 0
        )
    }

    var ozet: [KBStat] {
        guard let data else { return [] }
        let toplamStok = data.depolar.map(\.stokTon).reduce(0, +)
        let toplamKapasite = data.depolar.map(\.kapasite).reduce(0, +)
        let kritik = data.depolar.filter { $0.durum == "KRITIK" }.count
        return [
            KBStat(
                label: "Toplam stok",
                value: KBNumberFormat.miktar(toplamStok, birim: "ton"),
                tone: .accent
            ),
            KBStat(
                label: "Doluluk",
                value: "%\(Int((BitumMath.doluluk(stok: toplamStok, kapasite: toplamKapasite) * 100).rounded()))"
            ),
            KBStat(label: "Depo", value: "\(data.depolar.count)"),
            KBStat(
                label: "Kritik depo",
                value: "\(kritik)",
                tone: kritik > 0 ? .danger : .success
            ),
        ]
    }

    var ayarlarValid: Bool {
        ![
            depoKapasitesiTon, mesafeKm, tirKapasiteTon, yakitTlKm,
            referansAlisFiyat, kritikEsik, dusukEsik,
        ].contains { KBNumberFormat.isInvalid($0) }
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await api.fetchBitumOverview(tip: tipFiltre?.rawValue)
            data = response
            if let ayarlar = response.ayarlar { apply(ayarlar) }
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func saveSettings() async {
        isSaving = true
        saveError = nil
        do {
            let kaydedilen = try await api.saveBitumSettings(
                BitumSettingsRequestDTO(
                    depoKapasitesiTon: KBNumberFormat.parse(depoKapasitesiTon),
                    mesafeKm: KBNumberFormat.parse(mesafeKm),
                    tirKapasiteTon: KBNumberFormat.parse(tirKapasiteTon),
                    yakitTlKm: KBNumberFormat.parse(yakitTlKm),
                    referansAlisFiyat: KBNumberFormat.parse(referansAlisFiyat),
                    kritikEsik: KBNumberFormat.parse(kritikEsik),
                    dusukEsik: KBNumberFormat.parse(dusukEsik)
                )
            )
            apply(kaydedilen)
            // Eşikler değiştiği için depo durumları yeniden hesaplanmalı
            await load()
        } catch {
            saveError = APIError.describe(error)
        }
        isSaving = false
    }

    private func apply(_ ayarlar: BitumSettingsDTO) {
        depoKapasitesiTon = KBNumberFormat.text(ayarlar.depoKapasitesiTon)
        mesafeKm = KBNumberFormat.text(ayarlar.mesafeKm)
        tirKapasiteTon = KBNumberFormat.text(ayarlar.tirKapasiteTon)
        yakitTlKm = KBNumberFormat.text(ayarlar.yakitTlKm)
        referansAlisFiyat = KBNumberFormat.text(ayarlar.referansAlisFiyat)
        kritikEsik = KBNumberFormat.text(ayarlar.kritikEsik)
        dusukEsik = KBNumberFormat.text(ayarlar.dusukEsik)
    }
}

struct BitumMovementFormView: View {
    let depolar: [BitumDepotDTO]
    let ayarlar: BitumSettingsDTO?
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form: BitumMovementFormModel

    init(
        depolar: [BitumDepotDTO],
        ayarlar: BitumSettingsDTO?,
        onSaved: @escaping () -> Void
    ) {
        self.depolar = depolar
        self.ayarlar = ayarlar
        self.onSaved = onSaved
        _form = StateObject(wrappedValue: BitumMovementFormModel(ayarlar: ayarlar))
    }

    var body: some View {
        Form {
            Section("Hareket") {
                KBEnumField(title: "Hareket tipi", selection: $form.tip)
                KBDateField(title: "Tarih", date: $form.tarih, required: true)
                KBNumberField(
                    title: "Miktar",
                    text: $form.miktarTon,
                    required: true,
                    suffix: "ton",
                    error: form.hatalar["miktarTon"]
                )
            }

            switch form.tip {
            case .ALIS:
                Section("Alış") {
                    KBPickerField(
                        title: "Depo",
                        items: depolar,
                        selection: $form.depoId,
                        required: true,
                        placeholder: "Depo seçin",
                        error: form.hatalar["depoId"],
                        label: \.ad
                    )
                    KBNumberField(
                        title: "Alış fiyatı",
                        text: $form.alisFiyati,
                        suffix: "₺/ton",
                        error: form.hatalar["alisFiyati"]
                    )
                    KBDetailRow(label: "Alış maliyeti", value: form.alisMaliyetiMetni)
                }
            case .TASIMA:
                Section("Taşıma") {
                    KBPickerField(
                        title: "Kaynak depo",
                        items: depolar,
                        selection: $form.kaynakDepoId,
                        required: true,
                        placeholder: "Kaynak seçin",
                        error: form.hatalar["kaynakDepoId"],
                        label: \.ad
                    )
                    KBPickerField(
                        title: "Hedef depo",
                        items: depolar,
                        selection: $form.hedefDepoId,
                        required: true,
                        placeholder: "Hedef seçin",
                        error: form.hatalar["hedefDepoId"],
                        label: \.ad
                    )
                    KBDetailRow(label: "TIR sefer sayısı", value: form.seferSayisiMetni)
                    KBDetailRow(label: "Taşıma maliyeti", value: form.tasimaMaliyetiMetni)
                }
            case .KULLANIM:
                Section("Kullanım") {
                    KBPickerField(
                        title: "Kullanım deposu",
                        items: depolar,
                        selection: $form.kullanimDepoId,
                        required: true,
                        placeholder: "Depo seçin",
                        error: form.hatalar["kullanimDepoId"],
                        label: \.ad
                    )
                }
            }

            Section("Açıklama") {
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
        .navigationTitle("Bitüm Hareketi")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class BitumMovementFormModel: ObservableObject {
    @Published var tip: BitumMovementKind = .ALIS
    @Published var tarih: Date? = Date()
    @Published var miktarTon = ""
    @Published var alisFiyati = ""
    @Published var depoId: String?
    @Published var kaynakDepoId: String?
    @Published var hedefDepoId: String?
    @Published var kullanimDepoId: String?
    @Published var aciklama = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient
    private let ayarlar: BitumSettingsDTO?

    init(ayarlar: BitumSettingsDTO?, api: APIClient = .shared) {
        self.ayarlar = ayarlar
        self.api = api
        if let referans = ayarlar?.referansAlisFiyat {
            alisFiyati = KBNumberFormat.text(referans)
        }
    }

    private var miktar: Double? { KBNumberFormat.parse(miktarTon) }

    var alisMaliyetiMetni: String {
        guard let miktar, let fiyat = KBNumberFormat.parse(alisFiyati) else { return "—" }
        return KBNumberFormat.para(BitumMath.alisMaliyeti(miktarTon: miktar, fiyatTon: fiyat))
    }

    var seferSayisiMetni: String {
        guard let miktar, let kapasite = ayarlar?.tirKapasiteTon else { return "—" }
        return "\(BitumMath.tirSefer(miktarTon: miktar, tirKapasiteTon: kapasite))"
    }

    var tasimaMaliyetiMetni: String {
        guard let miktar, let ayarlar else { return "—" }
        let sefer = BitumMath.tirSefer(
            miktarTon: miktar,
            tirKapasiteTon: ayarlar.tirKapasiteTon
        )
        let seferMaliyeti = BitumMath.seferMaliyeti(
            mesafeKm: ayarlar.mesafeKm,
            yakitTlKm: ayarlar.yakitTlKm
        )
        return KBNumberFormat.para(Double(sefer) * seferMaliyeti)
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if let miktar {
            if miktar <= 0 { result["miktarTon"] = "Sıfırdan büyük olmalı" }
        } else {
            result["miktarTon"] = "Miktar zorunlu"
        }
        if KBNumberFormat.isInvalid(alisFiyati) {
            result["alisFiyati"] = "Geçerli bir sayı girin"
        }

        switch tip {
        case .ALIS:
            if depoId == nil { result["depoId"] = "Depo seçin" }
        case .TASIMA:
            if kaynakDepoId == nil { result["kaynakDepoId"] = "Kaynak depo seçin" }
            if hedefDepoId == nil { result["hedefDepoId"] = "Hedef depo seçin" }
            if kaynakDepoId != nil, kaynakDepoId == hedefDepoId {
                result["hedefDepoId"] = "Kaynak ve hedef aynı olamaz"
            }
        case .KULLANIM:
            if kullanimDepoId == nil { result["kullanimDepoId"] = "Depo seçin" }
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let tarih, let miktar, isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createBitumMovement(
                BitumMovementRequestDTO(
                    tip: tip.rawValue,
                    tarih: tarih.kbIsoGun,
                    miktarTon: miktar,
                    alisFiyati: tip == .ALIS ? KBNumberFormat.parse(alisFiyati) : nil,
                    depoId: tip == .ALIS ? depoId : nil,
                    kaynakDepoId: tip == .TASIMA ? kaynakDepoId : nil,
                    hedefDepoId: tip == .TASIMA ? hedefDepoId : nil,
                    kullanimDepoId: tip == .KULLANIM ? kullanimDepoId : nil,
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
