import SwiftUI

struct MaterialsView: View {
    @StateObject private var store = KBListStore(pageSize: 200) { limit in
        try await APIClient.shared.fetchMaterials(limit: limit)
    }
    @State private var arama = ""
    @State private var seviye = StokSeviyeFiltre.tumu
    @State private var showCreate = false

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Malzeme / Depo",
            description: "Depo stokları ve kritik seviye takibi.",
            action: KBHeaderAction(title: "Yeni Malzeme") { showCreate = true },
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Malzeme kaydı yok" : "Filtreye uyan malzeme yok",
                systemImage: "shippingbox.fill",
                message: store.isEmpty
                    ? "Depoya malzeme tanımlandığında burada listelenir."
                    : "Arama veya stok seviyesi filtresini değiştirin.",
                actionTitle: store.isEmpty ? "Yeni Malzeme" : nil,
                action: store.isEmpty ? { showCreate = true } : nil
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                ozet
            }
            KBSearchField(text: $arama, placeholder: "Malzeme adı veya depo ara...")
            KBChipRow(selection: $seviye, items: cipler)

            ForEach(liste) { malzeme in
                KBRecordCard(
                    title: malzeme.malzemeAdi ?? malzeme.id,
                    badges: [KBStatus.stok(miktar: malzeme.stokMiktari, kritik: malzeme.minStok)].compactMap { $0 },
                    subtitle: malzeme.depo.map { "Depo: \($0)" },
                    meta: meta(malzeme),
                    accent: vurgu(malzeme)
                )
            }

            KBLoadMoreRow(store: store, birim: "malzeme")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .sheet(isPresented: $showCreate) {
            MaterialCreateSheet(store: store) { showCreate = false }
        }
    }

    private var ozet: some View {
        KBStatGrid {
            KBStatCard(
                value: "\(store.items.count)",
                label: "Stok kalemi",
                icon: "shippingbox.fill"
            )
            KBStatCard(
                value: "\(kritikSayisi)",
                label: "Kritik seviye",
                icon: "exclamationmark.triangle.fill",
                tone: kritikSayisi > 0 ? KBTheme.danger : KBTheme.success
            )
        }
    }

    private var kritikSayisi: Int {
        store.items.filter { StokSeviyeFiltre.kritik.matches($0) }.count
    }

    private var cipler: [KBChipItem<StokSeviyeFiltre>] {
        StokSeviyeFiltre.allCases.map { filtre in
            KBChipItem(
                value: filtre,
                label: filtre.label,
                count: store.items.filter { filtre.matches($0) }.count
            )
        }
    }

    private var gorunen: [MaterialStockDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        return store.items.filter { malzeme in
            guard seviye.matches(malzeme) else { return false }
            guard !sorgu.isEmpty else { return true }
            return [malzeme.malzemeAdi, malzeme.depo].contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func meta(_ malzeme: MaterialStockDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let stok = KBFormat.sayi(malzeme.stokMiktari, birim: malzeme.birim) {
            chips.append(KBMetaChip(icon: "cube.box", text: "Stok \(stok)"))
        }
        if let minimum = KBFormat.sayi(malzeme.minStok, birim: malzeme.birim) {
            chips.append(KBMetaChip(icon: "arrow.down.to.line", text: "Kritik \(minimum)"))
        }
        return chips
    }

    private func vurgu(_ malzeme: MaterialStockDTO) -> Color {
        switch KBStatus.stok(miktar: malzeme.stokMiktari, kritik: malzeme.minStok)?.tone {
        case .danger: return KBTheme.danger
        case .warning: return KBTheme.warning
        case .success: return KBTheme.success
        default: return KBTheme.navy
        }
    }
}

enum StokSeviyeFiltre: String, CaseIterable, Hashable {
    case tumu, kritik, dikkat, normal

    var label: String {
        switch self {
        case .tumu: return "Tümü"
        case .kritik: return "Kritik"
        case .dikkat: return "Dikkat"
        case .normal: return "Normal"
        }
    }

    func matches(_ malzeme: MaterialStockDTO) -> Bool {
        guard self != .tumu else { return true }
        let badge = KBStatus.stok(miktar: malzeme.stokMiktari, kritik: malzeme.minStok)
        switch self {
        case .tumu: return true
        case .kritik: return badge?.tone == .danger
        case .dikkat: return badge?.tone == .warning
        case .normal: return badge?.tone == .success
        }
    }
}

private struct MaterialCreateSheet: View {
    @ObservedObject var store: KBListStore<MaterialStockDTO>
    let onClose: () -> Void

    @State private var kod = ""
    @State private var ad = ""
    @State private var birim = "ADET"

    private let birimler = ["ADET", "KG", "TON", "M3", "M2", "LT", "MT"]

    var body: some View {
        KBFormSheet(
            title: "Yeni Malzeme",
            subtitle: "Stok kartı oluşturulur; giriş miktarı sonradan işlenir.",
            submitTitle: "Malzemeyi Ekle",
            canSubmit: !kod.trimmingCharacters(in: .whitespaces).isEmpty
                && !ad.trimmingCharacters(in: .whitespaces).isEmpty,
            isSubmitting: store.isSubmitting,
            errorMessage: store.errorMessage,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            KBFormTextField(title: "Malzeme kodu", required: true, placeholder: "MLZ-001", text: $kod)
            KBFormTextField(title: "Malzeme adı", required: true, placeholder: "Çimento", text: $ad)
            KBFormPicker(
                title: "Birim",
                selection: $birim,
                options: birimler.map { KBPickerOption(value: $0, label: $0) }
            )
        }
    }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "Malzeme eklendi") {
                try await APIClient.shared.createMaterial(
                    kod: kod.trimmingCharacters(in: .whitespaces),
                    ad: ad.trimmingCharacters(in: .whitespaces),
                    birim: birim
                )
            }
            if ok { onClose() }
        }
    }
}
