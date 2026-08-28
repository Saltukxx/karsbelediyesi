import SwiftUI

struct ConcreteView: View {
    @StateObject private var store = KBListStore { try await APIClient.shared.fetchConcrete() }
    @State private var arama = ""
    @State private var uretimIcin: ConcreteRecipeDTO?

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Beton Reçeteleri",
            description: "Reçete bazlı stok durumu ve üretim girişi.",
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Reçete yok" : "Aramaya uyan reçete yok",
                systemImage: "square.stack.3d.up.fill",
                message: store.isEmpty
                    ? "Beton reçeteleri tanımlandığında burada listelenir."
                    : "Farklı bir reçete adı veya sınıf araması deneyin."
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                KBStatGrid {
                    KBStatCard(
                        value: "\(store.items.count)",
                        label: "Tanımlı reçete",
                        icon: "square.stack.3d.up.fill"
                    )
                    KBStatCard(
                        value: "\(kritikSayisi)",
                        label: "Kritik stok",
                        icon: "exclamationmark.triangle.fill",
                        tone: kritikSayisi > 0 ? KBTheme.danger : KBTheme.success
                    )
                }
            }
            KBSearchField(text: $arama, placeholder: "Reçete adı veya sınıf ara...")

            ForEach(liste) { recete in
                KBRecordCard(
                    title: recete.receteAdi ?? recete.id,
                    badges: rozetler(recete),
                    subtitle: recete.sinif.map { "Sınıf \($0)" },
                    meta: meta(recete),
                    actions: [
                        KBRecordAction(
                            id: "\(recete.id)-uretim",
                            title: "Üretim Gir",
                            icon: "plus",
                            kind: .primary
                        ) { uretimIcin = recete },
                    ],
                    accent: vurgu(recete)
                )
            }
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .sheet(item: $uretimIcin) { recete in
            ConcreteProductionSheet(store: store, recete: recete) { uretimIcin = nil }
        }
    }

    private var kritikSayisi: Int {
        store.items.filter { ($0.durum ?? "").uppercased() == "KRITIK" }.count
    }

    private var gorunen: [ConcreteRecipeDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return store.items }
        return store.items.filter { recete in
            [recete.receteAdi, recete.sinif].contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func rozetler(_ recete: ConcreteRecipeDTO) -> [KBBadge] {
        guard let durum = recete.durum?.uppercased() else { return [] }
        switch durum {
        case "KRITIK": return [KBBadge(text: "Kritik", tone: .danger)]
        case "AZ": return [KBBadge(text: "Az", tone: .warning)]
        case "YETERLI": return [KBBadge(text: "Yeterli", tone: .success)]
        default: return [KBBadge(text: durum.capitalized, tone: .neutral)]
        }
    }

    private func meta(_ recete: ConcreteRecipeDTO) -> [KBMetaChip] {
        guard let stok = KBFormat.sayi(recete.guncelStok, birim: "m³") else { return [] }
        return [KBMetaChip(icon: "cube.box", text: "Güncel stok \(stok)")]
    }

    private func vurgu(_ recete: ConcreteRecipeDTO) -> Color {
        switch recete.durum?.uppercased() {
        case "KRITIK": return KBTheme.danger
        case "AZ": return KBTheme.warning
        default: return KBTheme.success
        }
    }
}

private struct ConcreteProductionSheet: View {
    @ObservedObject var store: KBListStore<ConcreteRecipeDTO>
    let recete: ConcreteRecipeDTO
    let onClose: () -> Void

    @State private var hedefM3 = ""

    var body: some View {
        KBFormSheet(
            title: "Üretim Girişi",
            subtitle: recete.receteAdi,
            submitTitle: "Üretimi Kaydet",
            canSubmit: miktar > 0,
            isSubmitting: store.isSubmitting,
            errorMessage: store.errorMessage,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            KBFormTextField(
                title: "Hedef üretim (m³)",
                required: true,
                placeholder: "25",
                text: $hedefM3,
                keyboard: .decimalPad
            )
        }
    }

    private var miktar: Double {
        Double(hedefM3.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "Üretim kaydedildi") {
                try await APIClient.shared.createConcrete(recipeId: recete.id, hedefM3: miktar)
            }
            if ok { onClose() }
        }
    }
}
