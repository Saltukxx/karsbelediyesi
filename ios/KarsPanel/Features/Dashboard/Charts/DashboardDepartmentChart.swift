import SwiftUI

/// Müdürlük bazlı şikayet dağılımı — açık / devam eden / kapatıldı yığılmış bar.
/// En çok şikayet alan müdürlük üstte durur; satıra dokunmak kırılımı açar.
struct DashboardDepartmentChart: View {
    let items: [DashboardMudurlukDTO]

    var body: some View {
        let bars = DashboardChartData.departments(from: items)

        KBChartCard(
            title: "Müdürlük bazlı dağılım",
            description: "En çok şikayet alan 8 müdürlük",
            isEmpty: bars.isEmpty,
            destination: .sikayetler
        ) {
            KBRankedBarList(
                rows: bars.map { bar in
                    KBRankedBarList.Row(
                        name: DashboardChartData.kisaMudurluk(bar.name),
                        segments: [
                            .init(name: "Açık", value: bar.acik, color: KBChart.acik),
                            .init(name: "Devam", value: bar.devam, color: KBChart.devam),
                            .init(name: "Kapatıldı", value: bar.kapatildi, color: KBChart.kapatildi),
                        ]
                    )
                }
            )

            KBChartLegend(
                items: [
                    .init(name: "Açık", value: KBChartFormat.adet(bars.reduce(0) { $0 + $1.acik }), color: KBChart.acik),
                    .init(name: "Devam eden", value: KBChartFormat.adet(bars.reduce(0) { $0 + $1.devam }), color: KBChart.devam),
                    .init(name: "Kapatıldı", value: KBChartFormat.adet(bars.reduce(0) { $0 + $1.kapatildi }), color: KBChart.kapatildi),
                ],
                columns: 1
            )
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Müdürlük bazlı şikayet dağılımı")
    }
}
