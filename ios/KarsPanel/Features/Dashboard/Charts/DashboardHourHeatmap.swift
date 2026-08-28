import Charts
import SwiftUI

/// Şikayetlerin haftanın günü / günün saati kırılımı — 7x24 ısı haritası.
///
/// Renk rampası web'deki `visualMap` ile aynıdır. Bir hücreye dokunulduğunda
/// gün, saat aralığı ve adet tooltip'te gösterilir.
struct DashboardHourHeatmap: View {
    let cells: [DashboardSaatlikDTO]

    @State private var secilenSaat: String?
    @State private var secilenGun: String?

    var body: some View {
        let matris = DashboardChartData.heatMatrix(from: cells)
        let enYuksek = DashboardChartData.heatMax(matris)
        let secili = seciliHucre(in: matris)

        KBChartCard(
            title: "Saatlik yoğunluk",
            description: "Şikayetler haftanın hangi günü, günün hangi saatinde geliyor",
            isEmpty: cells.isEmpty || matris.allSatisfy({ $0.adet == 0 })
        ) {
            Chart(matris) { cell in
                RectangleMark(
                    x: .value("Saat", DashboardChartData.saatEtiketi(cell.saat)),
                    y: .value("Gün", DashboardChartData.gunEtiketi(cell.haftaGunu))
                )
                // Hücrelerin çoğu düşük sayıda kalıyor; doğrusal rampada tablo
                // baştan aşağı soluk görünüyor. Hafif gama düzeltmesi düşük
                // değerleri ayırt edilebilir yapar, tepe noktayı bozmaz.
                .foregroundStyle(KBChart.isi(pow(Double(cell.adet) / Double(enYuksek), 0.6)))
                .cornerRadius(1.5)
                .opacity(vurgu(cell))
            }
            .chartXScale(domain: (0...23).map(DashboardChartData.saatEtiketi))
            .chartYScale(domain: DashboardChartData.haftaGunleri)
            .chartXSelection(value: $secilenSaat)
            .chartYSelection(value: $secilenGun)
            .chartXAxis {
                // 24 etiket dar ekranda okunmaz; üç saatte bir gösterilir.
                AxisMarks(
                    values: stride(from: 0, through: 23, by: 3).map(DashboardChartData.saatEtiketi)
                ) { value in
                    AxisValueLabel {
                        if let saat = value.as(String.self) {
                            Text(saat)
                                .font(.system(size: 9))
                                .foregroundStyle(KBTheme.muted)
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisValueLabel {
                        if let gun = value.as(String.self) {
                            Text(gun)
                                .font(.system(size: 9))
                                .foregroundStyle(KBTheme.muted)
                        }
                    }
                }
            }
            .frame(height: 168)
            .animation(.easeInOut(duration: 0.35), value: matris)
            .onChange(of: secilenSaat) { _, yeni in
                if yeni != nil { KBChartHaptics.selectionChanged() }
            }

            if let secili {
                KBChartTooltip(
                    title: "\(DashboardChartData.gunEtiketi(secili.haftaGunu)) \(DashboardChartData.saatEtiketi(secili.saat)):00–\(DashboardChartData.saatEtiketi(secili.saat + 1)):00",
                    rows: [.init(label: "Şikayet", value: KBChartFormat.adet(secili.adet))]
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            renkSkalasi(enYuksek: enYuksek)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Gün ve saat bazlı şikayet yoğunluğu")
    }

    private func renkSkalasi(enYuksek: Int) -> some View {
        HStack(spacing: 6) {
            Text("0")
                .font(.system(size: 9))
                .foregroundStyle(KBTheme.muted)
            LinearGradient(
                colors: stride(from: 0.0, through: 1.0, by: 0.1).map { KBChart.isi($0) },
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 6)
            .clipShape(Capsule())
            Text(KBChartFormat.adet(enYuksek))
                .font(.system(size: 9))
                .foregroundStyle(KBTheme.muted)
        }
    }

    private func vurgu(_ cell: ChartHeatCell) -> Double {
        guard secilenSaat != nil || secilenGun != nil else { return 1 }
        let saatUyar = secilenSaat == nil || secilenSaat == DashboardChartData.saatEtiketi(cell.saat)
        let gunUyar = secilenGun == nil || secilenGun == DashboardChartData.gunEtiketi(cell.haftaGunu)
        return saatUyar && gunUyar ? 1 : 0.35
    }

    private func seciliHucre(in matris: [ChartHeatCell]) -> ChartHeatCell? {
        guard let secilenSaat, let secilenGun else { return nil }
        return matris.first {
            DashboardChartData.saatEtiketi($0.saat) == secilenSaat
                && DashboardChartData.gunEtiketi($0.haftaGunu) == secilenGun
        }
    }
}
