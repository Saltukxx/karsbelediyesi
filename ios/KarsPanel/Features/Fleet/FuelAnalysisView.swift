import SwiftUI

/// Akaryakıt analizi: araç bazlı ortalama tüketim ve norm sapması. Salt okunur ekran,
/// kayıt girişi Yakıt Takip üzerinden yapılır.
struct FuelAnalysisView: View {
    @StateObject private var store = KBListStore { try await APIClient.shared.fetchFuelAnalysis() }
    @State private var arama = ""

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Akaryakıt Analizi",
            description: "Araç bazlı ortalama tüketim ve norm sapması.",
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Analiz verisi yok" : "Aramaya uyan araç yok",
                systemImage: "chart.line.uptrend.xyaxis",
                message: store.isEmpty
                    ? "Yeterli yakıt kaydı biriktiğinde tüketim analizi burada görünür."
                    : "Farklı bir plaka araması deneyin."
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                KBStatGrid {
                    KBStatCard(
                        value: "\(store.items.count)",
                        label: "Analiz edilen araç",
                        icon: "car.fill"
                    )
                    KBStatCard(
                        value: "\(sapanlar.count)",
                        label: "Norm dışı tüketim",
                        icon: "exclamationmark.triangle.fill",
                        tone: sapanlar.isEmpty ? KBTheme.success : KBTheme.warning
                    )
                }
            }
            KBSearchField(text: $arama, placeholder: "Plaka ara...")

            ForEach(liste) { satir in
                KBRecordCard(
                    title: satir.plaka ?? satir.id,
                    badges: [sapmaRozeti(satir)].compactMap { $0 },
                    subtitle: satir.donem.map { "Dönem: \($0)" },
                    meta: meta(satir),
                    accent: sapmaRengi(satir)
                )
            }
        }
        .task { await store.loadIfNeeded() }
    }

    private var gorunen: [FuelAnalysisDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return store.items }
        return store.items.filter { KBSearch.eslesir($0.plaka, sorgu) }
    }

    /// Norm üstü tüketim: sapma yüzdesi %10'un üzerindeki araçlar.
    private var sapanlar: [FuelAnalysisDTO] {
        store.items.filter { ($0.sapmaYuzde ?? 0) > 10 }
    }

    private func sapmaRozeti(_ satir: FuelAnalysisDTO) -> KBBadge? {
        guard let sapma = satir.sapmaYuzde else { return nil }
        let metin = "\(sapma > 0 ? "+" : "")\(KBFormat.ondalik(sapma, basamak: 1))%"
        if sapma > 10 { return KBBadge(text: metin, tone: .danger) }
        if sapma > 0 { return KBBadge(text: metin, tone: .warning) }
        return KBBadge(text: metin, tone: .success)
    }

    private func sapmaRengi(_ satir: FuelAnalysisDTO) -> Color {
        guard let sapma = satir.sapmaYuzde else { return KBTheme.navy }
        if sapma > 10 { return KBTheme.danger }
        if sapma > 0 { return KBTheme.warning }
        return KBTheme.success
    }

    private func meta(_ satir: FuelAnalysisDTO) -> [KBMetaChip] {
        guard let ortalama = satir.ortalamaTuketim else { return [] }
        return [KBMetaChip(icon: "fuelpump", text: "\(KBFormat.ondalik(ortalama, basamak: 1)) L/100 km")]
    }
}
