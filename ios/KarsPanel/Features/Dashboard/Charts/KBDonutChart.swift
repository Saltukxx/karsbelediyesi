import Charts
import SwiftUI

/// Panelin donut grafiklerinin ortak gövdesi.
///
/// Web'de olduğu gibi solda halka, sağda dikey açıklama listesi durur. Ortadaki
/// toplam, bir dilim seçildiğinde o dilimin adı ve payıyla değişir.
struct KBDonutChart: View {
    let slices: [ChartSlice]
    /// Dilim adına göre sabit renk; verilmezse kategorik palet sırayla uygulanır.
    var renkler: ((String) -> Color)? = nil
    var birim: String

    @State private var secilenAci: Int?

    private var toplam: Int { slices.reduce(0) { $0 + $1.value } }

    private var seciliIndex: Int? {
        DashboardChartData.sliceIndex(forAngleValue: secilenAci, in: slices)
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            halka
            aciklamaListesi
        }
        .animation(.easeInOut(duration: 0.35), value: slices)
        .onChange(of: secilenAci) { _, yeni in
            if yeni != nil { KBChartHaptics.selectionChanged() }
        }
    }

    private var halka: some View {
        ZStack {
            Chart(Array(slices.enumerated()), id: \.element.id) { index, slice in
                SectorMark(
                    angle: .value("Adet", slice.value),
                    innerRadius: .ratio(0.62),
                    angularInset: 1.5
                )
                .foregroundStyle(renk(for: slice, at: index))
                .cornerRadius(3)
                .opacity(seciliIndex == nil || seciliIndex == index ? 1 : 0.35)
            }
            .chartAngleSelection(value: $secilenAci)
            .chartLegend(.hidden)
            .frame(width: 132, height: 132)

            merkez
        }
    }

    @ViewBuilder
    private var merkez: some View {
        if let index = seciliIndex, slices.indices.contains(index) {
            let slice = slices[index]
            VStack(spacing: 1) {
                Text(KBChartFormat.adet(slice.value))
                    .font(.title3.weight(.bold))
                    .foregroundStyle(KBTheme.navy)
                Text("%\(KBChartFormat.yuzde(slice.value, of: toplam))")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(KBTheme.muted)
                Text(slice.name)
                    .font(.system(size: 9))
                    .foregroundStyle(KBTheme.muted)
                    .lineLimit(1)
                    .frame(maxWidth: 74)
            }
        } else {
            VStack(spacing: 1) {
                Text(KBChartFormat.adet(toplam))
                    .font(.title3.weight(.bold))
                    .foregroundStyle(KBTheme.navy)
                Text(birim)
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }
        }
    }

    private var aciklamaListesi: some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(Array(slices.enumerated()), id: \.element.id) { index, slice in
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(renk(for: slice, at: index))
                        .frame(width: 9, height: 9)
                    Text(slice.name)
                        .font(.caption2)
                        .foregroundStyle(KBTheme.muted)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Spacer(minLength: 4)
                    Text(KBChartFormat.adet(slice.value))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(KBTheme.navy)
                }
                .opacity(seciliIndex == nil || seciliIndex == index ? 1 : 0.4)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(
                    "\(slice.name): \(slice.value), yüzde \(KBChartFormat.yuzde(slice.value, of: toplam))"
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func renk(for slice: ChartSlice, at index: Int) -> Color {
        renkler?(slice.name) ?? KBChart.kategorik(index)
    }
}

// MARK: - Panele özel donut kartları

struct DashboardTypeChart: View {
    let items: [DashboardTurDTO]

    var body: some View {
        let slices = DashboardChartData.types(from: items)
        KBChartCard(
            title: "Şikayet türü dağılımı",
            description: "Seçili dönemde kayda giren şikayetler",
            isEmpty: slices.isEmpty,
            destination: .sikayetler
        ) {
            KBDonutChart(slices: slices, birim: "şikayet")
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Şikayet türü dağılımı")
    }
}

struct DashboardVehicleStatusChart: View {
    let aracOperasyon: [String: Int]

    var body: some View {
        let slices = DashboardChartData.vehicles(from: aracOperasyon)
        KBChartCard(
            title: "Araç operasyon durumu",
            description: "Filonun anlık dağılımı",
            isEmpty: slices.isEmpty,
            emptyText: "Kayıtlı araç yok",
            destination: .araclar
        ) {
            KBDonutChart(
                slices: slices,
                renkler: { KBChart.aracRengi(DashboardChartData.vehicleKey(forLabel: $0)) },
                birim: "araç"
            )
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Araç operasyon durumu dağılımı")
    }
}

struct DashboardChannelChart: View {
    let items: [DashboardKanalDTO]

    var body: some View {
        let slices = DashboardChartData.channels(from: items)
        KBChartCard(
            title: "Kanal dağılımı",
            description: "Şikayetler hangi kanaldan geliyor",
            isEmpty: slices.isEmpty,
            destination: .sikayetler
        ) {
            KBDonutChart(
                slices: slices,
                renkler: { KBChart.kanalRengi($0) },
                birim: "şikayet"
            )
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Şikayet kanal dağılımı")
    }
}
