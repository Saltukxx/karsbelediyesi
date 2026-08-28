import SwiftUI

/// En çok şikayet üreten mahalleler — sıralı yatay bar.
struct DashboardNeighborhoodChart: View {
    let items: [DashboardMahalleDTO]

    var body: some View {
        let data = DashboardChartData.neighborhoods(from: items)

        KBChartCard(
            title: "Mahalle yoğunluğu",
            description: "Seçili dönemde en çok şikayet üreten 10 mahalle",
            isEmpty: data.isEmpty,
            destination: .harita
        ) {
            KBRankedBarList(
                rows: data.map { item in
                    KBRankedBarList.Row(
                        name: DashboardChartData.kisaMahalle(item.name),
                        segments: [.init(name: item.name, value: item.value, color: KBChart.tekil)]
                    )
                }
            )
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Mahalle bazlı şikayet yoğunluğu")
    }
}
