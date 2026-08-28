import SwiftUI

/// Agrega maliyet analizi. Parametre girişi web panelinde yapılır; mobilde sonuçlar okunur.
struct AgregaView: View {
    @StateObject private var store = KBListStore { try await APIClient.shared.fetchAgrega() }
    @State private var arama = ""

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Agrega Maliyet",
            description: "Malzeme bazlı birim fiyat ve toplam maliyet.",
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Maliyet kalemi yok" : "Aramaya uyan kalem yok",
                systemImage: "chart.bar.fill",
                message: store.isEmpty
                    ? "Agrega parametreleri web panelinden girildiğinde sonuçlar burada görünür."
                    : "Farklı bir malzeme araması deneyin."
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                KBStatGrid {
                    KBStatCard(
                        value: "\(store.items.count)",
                        label: "Maliyet kalemi",
                        icon: "list.bullet.rectangle"
                    )
                    KBStatCard(
                        value: KBFormat.para(toplam) ?? "0 ₺",
                        label: "Toplam maliyet",
                        icon: "turkishlirasign.circle.fill",
                        tone: KBTheme.accent
                    )
                }
            }
            KBSearchField(text: $arama, placeholder: "Malzeme ara...")

            ForEach(liste) { kalem in
                KBRecordCard(
                    title: kalem.malzeme ?? kalem.id,
                    badges: [KBBadge(text: KBFormat.para(kalem.toplam) ?? "—", tone: .accent)],
                    meta: meta(kalem),
                    accent: KBTheme.accent
                )
            }
        }
        .task { await store.loadIfNeeded() }
    }

    private var toplam: Double { store.items.reduce(0) { $0 + ($1.toplam ?? 0) } }

    private var gorunen: [AgregaCostDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return store.items }
        return store.items.filter { KBSearch.eslesir($0.malzeme, sorgu) }
    }

    private func meta(_ kalem: AgregaCostDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let birimFiyat = KBFormat.para(kalem.birimFiyat) {
            chips.append(KBMetaChip(icon: "turkishlirasign.circle", text: "Birim \(birimFiyat)"))
        }
        if let miktar = KBFormat.sayi(kalem.miktar, birim: "ton") {
            chips.append(KBMetaChip(icon: "scalemass", text: miktar))
        }
        return chips
    }
}
