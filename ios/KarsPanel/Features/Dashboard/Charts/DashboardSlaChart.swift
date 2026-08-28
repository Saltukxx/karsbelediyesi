import SwiftUI

/// Açık şikayetlerin yaş dağılımı — tek %100 şerit.
///
/// Web'de olduğu gibi üç ayrı bar yerine tek şerit kullanılır: oran bir bakışta
/// okunur ve dar ekranda çok daha az yer kaplar. Swift Charts yerine düz
/// SwiftUI ile çizilir; böylece uçların yuvarlanması, beyaz ayraçlar ve segment
/// içi etiketler tam kontrol altında kalır.
struct DashboardSlaChart: View {
    let sla: DashboardSlaDTO

    @State private var secilen: String?

    private static let barHeight: CGFloat = 34

    private var renkler: [String: Color] {
        [
            "24 saatten az": KBChart.slaHizli,
            "1–3 gün": KBChart.slaOrta,
            "3 günden fazla": KBChart.slaYavas,
        ]
    }

    var body: some View {
        let segments = DashboardChartData.slaSegments(from: sla)
        let toplam = segments.reduce(0) { $0 + $1.value }

        KBChartCard(
            title: "Açık şikayet bekleme süresi",
            description: "Şu an açık ve devam eden şikayetlerin yaşı",
            isEmpty: toplam == 0,
            emptyText: "Açık şikayet yok",
            destination: .sikayetler
        ) {
            GeometryReader { geo in
                HStack(spacing: 1.5) {
                    ForEach(segments.filter { $0.value > 0 }) { segment in
                        let oran = Double(segment.value) / Double(toplam)
                        let genislik = max(geo.size.width * oran - 1.5, 2)

                        ZStack {
                            Rectangle()
                                .fill(renkler[segment.name] ?? KBTheme.navy)
                            if genislik > 26 {
                                Text(KBChartFormat.adet(segment.value))
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(width: genislik)
                        .opacity(secilen == nil || secilen == segment.name ? 1 : 0.4)
                        .onTapGesture {
                            KBChartHaptics.selectionChanged()
                            secilen = secilen == segment.name ? nil : segment.name
                        }
                        .accessibilityLabel(
                            "\(segment.name): \(segment.value) şikayet, yüzde \(KBChartFormat.yuzde(segment.value, of: toplam))"
                        )
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            }
            .frame(height: Self.barHeight)
            .animation(.easeInOut(duration: 0.35), value: segments)

            KBChartLegend(
                items: segments.map { segment in
                    .init(
                        name: segment.name,
                        value: "\(KBChartFormat.adet(segment.value)) · %\(KBChartFormat.yuzde(segment.value, of: toplam))",
                        color: renkler[segment.name] ?? KBTheme.navy
                    )
                },
                columns: 1
            )
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Açık şikayet bekleme süresi dağılımı")
    }
}
