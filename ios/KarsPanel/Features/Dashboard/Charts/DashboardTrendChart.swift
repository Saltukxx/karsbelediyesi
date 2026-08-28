import Charts
import SwiftUI

/// Günlük açılan / kapanan şikayet trendi.
///
/// Web'deki iki seri, gradyanlı alan ve dönem ortalaması çizgisi birebir taşınır.
/// Grafiğe dokunulduğunda o güne ait iki değer de tek tooltip'te gösterilir.
struct DashboardTrendChart: View {
    let points: [DashboardTrendPointDTO]

    @State private var secilenTarih: Date?

    private var veri: [ChartTrendPoint] { DashboardChartData.trend(from: points) }

    var body: some View {
        let data = veri
        let ortalama = DashboardChartData.ortalamaAcilan(data)
        let secili = seciliNokta(in: data)

        KBChartCard(
            title: "Şikayet trendi",
            description: "Seçili dönemde günlük açılan ve kapanan şikayet",
            isEmpty: data.isEmpty || DashboardChartData.trendBos(data),
            destination: .sikayetler
        ) {
            Chart {
                ForEach(data) { point in
                    AreaMark(
                        x: .value("Gün", point.date),
                        y: .value("Adet", point.acilan),
                        series: .value("Seri", "Açılan")
                    )
                    .foregroundStyle(KBChart.alanGradyani(KBChart.acilan))
                    .interpolationMethod(.catmullRom)

                    AreaMark(
                        x: .value("Gün", point.date),
                        y: .value("Adet", point.kapanan),
                        series: .value("Seri", "Kapanan")
                    )
                    .foregroundStyle(KBChart.alanGradyani(KBChart.kapanan, tavan: 0.16))
                    .interpolationMethod(.catmullRom)

                    LineMark(
                        x: .value("Gün", point.date),
                        y: .value("Adet", point.acilan),
                        series: .value("Seri", "Açılan")
                    )
                    .foregroundStyle(KBChart.acilan)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                    .interpolationMethod(.catmullRom)

                    LineMark(
                        x: .value("Gün", point.date),
                        y: .value("Adet", point.kapanan),
                        series: .value("Seri", "Kapanan")
                    )
                    .foregroundStyle(KBChart.kapanan)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                    .interpolationMethod(.catmullRom)
                }

                if ortalama > 0 {
                    RuleMark(y: .value("Ortalama", ortalama))
                        .foregroundStyle(KBTheme.muted.opacity(0.7))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .annotation(position: .top, alignment: .trailing, spacing: 1) {
                            Text("ort. \(String(format: "%.1f", ortalama))")
                                .font(.system(size: 9))
                                .foregroundStyle(KBTheme.muted)
                        }
                }

                if let secili {
                    RuleMark(x: .value("Gün", secili.date))
                        .foregroundStyle(KBTheme.navy.opacity(0.25))
                        .lineStyle(StrokeStyle(lineWidth: 1))
                        .annotation(
                            position: .top,
                            spacing: 4,
                            overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                        ) {
                            KBChartTooltip(
                                title: KBChartFormat.gunEtiketi(secili.date),
                                rows: [
                                    .init(
                                        label: "Açılan",
                                        value: KBChartFormat.adet(secili.acilan),
                                        color: KBChart.acilan
                                    ),
                                    .init(
                                        label: "Kapanan",
                                        value: KBChartFormat.adet(secili.kapanan),
                                        color: KBChart.kapanan
                                    ),
                                ]
                            )
                        }

                    PointMark(
                        x: .value("Gün", secili.date),
                        y: .value("Adet", secili.acilan)
                    )
                    .foregroundStyle(KBChart.acilan)
                    .symbolSize(60)

                    PointMark(
                        x: .value("Gün", secili.date),
                        y: .value("Adet", secili.kapanan)
                    )
                    .foregroundStyle(KBChart.kapanan)
                    .symbolSize(60)
                }
            }
            .chartXSelection(value: $secilenTarih)
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        .foregroundStyle(KBTheme.border)
                    AxisValueLabel {
                        if let sayi = value.as(Int.self) {
                            Text(KBChartFormat.adet(sayi))
                                .font(.system(size: 10))
                                .foregroundStyle(KBTheme.muted)
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4)) { value in
                    AxisValueLabel {
                        if let date = value.as(Date.self) {
                            Text(KBChartFormat.gunEtiketi(date))
                                .font(.system(size: 10))
                                .foregroundStyle(KBTheme.muted)
                        }
                    }
                }
            }
            .chartLegend(.hidden)
            .frame(height: 200)
            .animation(.easeInOut(duration: 0.35), value: data)
            .onChange(of: secilenTarih) { _, yeni in
                if yeni != nil { KBChartHaptics.selectionChanged() }
            }

            KBChartLegend(items: [
                .init(name: "Açılan", value: KBChartFormat.adet(toplam(data, \.acilan)), color: KBChart.acilan),
                .init(name: "Kapanan", value: KBChartFormat.adet(toplam(data, \.kapanan)), color: KBChart.kapanan),
            ])
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Günlük şikayet trendi")
    }

    private func toplam(_ data: [ChartTrendPoint], _ key: KeyPath<ChartTrendPoint, Int>) -> Int {
        data.reduce(0) { $0 + $1[keyPath: key] }
    }

    /// Seçim ham bir tarih verir; en yakın veri noktasına oturtulur.
    private func seciliNokta(in data: [ChartTrendPoint]) -> ChartTrendPoint? {
        guard let secilenTarih else { return nil }
        return data.min {
            abs($0.date.timeIntervalSince(secilenTarih))
                < abs($1.date.timeIntervalSince(secilenTarih))
        }
    }
}
