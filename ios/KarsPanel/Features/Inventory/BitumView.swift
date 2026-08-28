import SwiftUI

/// Bitüm hareketleri. Depo tanımları web panelinde yönetildiği için mobilde hareketler okunur.
struct BitumView: View {
    @StateObject private var store = KBListStore(pageSize: 100) { limit in
        try await APIClient.shared.fetchBitum(limit: limit)
    }
    @State private var arama = ""

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Bitüm Takip",
            description: "Proje bazlı bitüm hareketleri ve toplam tüketim.",
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Bitüm hareketi yok" : "Aramaya uyan hareket yok",
                systemImage: "drop.fill",
                message: store.isEmpty
                    ? "Depo giriş ve çıkışları işlendiğinde burada listelenir."
                    : "Farklı bir proje araması deneyin."
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                KBStatGrid {
                    KBStatCard(
                        value: "\(store.items.count)",
                        label: "Hareket kaydı",
                        icon: "arrow.left.arrow.right"
                    )
                    KBStatCard(
                        value: KBFormat.sayi(toplamMiktar, birim: "ton") ?? "0",
                        label: "Toplam miktar",
                        icon: "drop.fill",
                        tone: KBTheme.info
                    )
                }
            }
            KBSearchField(text: $arama, placeholder: "Proje veya açıklama ara...")

            ForEach(liste) { hareket in
                KBRecordCard(
                    title: hareket.proje ?? "Proje belirtilmemiş",
                    badges: [KBBadge(text: KBFormat.sayi(hareket.miktar, birim: "ton") ?? "—", tone: .info)],
                    subtitle: hareket.aciklama,
                    meta: KBFormat.tarih(hareket.tarih).map { [KBMetaChip(icon: "calendar", text: $0)] } ?? [],
                    accent: KBTheme.info
                )
            }

            KBLoadMoreRow(store: store, birim: "hareket")
        }
        .task { await store.loadIfNeeded() }
    }

    private var toplamMiktar: Double { store.items.reduce(0) { $0 + ($1.miktar ?? 0) } }

    private var gorunen: [BitumRecordDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return store.items }
        return store.items.filter { hareket in
            [hareket.proje, hareket.aciklama].contains { KBSearch.eslesir($0, sorgu) }
        }
    }
}
