import Charts
import SwiftUI

/// Aylık bakım ve yakıt gideri — dikey yığılmış bar.
/// Bir aya dokunulduğunda kalem kırılımı ve toplam tooltip'te gösterilir.
struct DashboardCostChart: View {
    let points: [DashboardMaliyetPointDTO]

    @State private var secilenAy: String?

    var body: some View {
        let data = DashboardChartData.cost(from: points)
        let secili = data.first { $0.label == secilenAy }

        KBChartCard(
            title: "Operasyon maliyeti",
            description: "Aylık bakım ve yakıt gideri",
            isEmpty: data.isEmpty || data.allSatisfy({ $0.toplam == 0 }),
            destination: .yakit
        ) {
            Chart {
                ForEach(data) { point in
                    BarMark(
                        x: .value("Ay", point.label),
                        y: .value("Tutar", point.bakim),
                        width: .fixed(26)
                    )
                    .foregroundStyle(KBChart.bakim)
                    .opacity(vurgu(point.label))

                    BarMark(
                        x: .value("Ay", point.label),
                        y: .value("Tutar", point.yakit),
                        width: .fixed(26)
                    )
                    .foregroundStyle(KBChart.yakit)
                    .opacity(vurgu(point.label))
                }

                if let secili {
                    RuleMark(x: .value("Ay", secili.label))
                        .foregroundStyle(.clear)
                        .annotation(
                            position: .top,
                            spacing: 4,
                            overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                        ) {
                            KBChartTooltip(
                                title: secili.label,
                                rows: [
                                    .init(label: "Bakım", value: KBChartFormat.tl(secili.bakim), color: KBChart.bakim),
                                    .init(label: "Yakıt", value: KBChartFormat.tl(secili.yakit), color: KBChart.yakit),
                                    .init(label: "Toplam", value: KBChartFormat.tl(secili.toplam)),
                                ]
                            )
                        }
                }
            }
            .chartXSelection(value: $secilenAy)
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        .foregroundStyle(KBTheme.border)
                    AxisValueLabel {
                        if let tutar = value.as(Double.self) {
                            Text(KBChartFormat.tlEksen(tutar))
                                .font(.system(size: 10))
                                .foregroundStyle(KBTheme.muted)
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel {
                        if let ay = value.as(String.self) {
                            Text(ay)
                                .font(.system(size: 9))
                                .foregroundStyle(KBTheme.muted)
                        }
                    }
                }
            }
            .chartLegend(.hidden)
            .frame(height: 200)
            .animation(.easeInOut(duration: 0.35), value: data)
            .onChange(of: secilenAy) { _, yeni in
                if yeni != nil { KBChartHaptics.selectionChanged() }
            }

            KBChartLegend(items: [
                .init(name: "Bakım", value: KBChartFormat.tl(data.reduce(0) { $0 + $1.bakim }), color: KBChart.bakim),
                .init(name: "Yakıt", value: KBChartFormat.tl(data.reduce(0) { $0 + $1.yakit }), color: KBChart.yakit),
            ])
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Aylık operasyon maliyeti")
    }

    private func vurgu(_ label: String) -> Double {
        guard let secilenAy else { return 1 }
        return secilenAy == label ? 1 : 0.4
    }
}
