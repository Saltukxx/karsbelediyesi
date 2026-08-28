import SwiftUI

/// Sıralı yatay bar listesi (müdürlük ve mahalle kartları).
///
/// Swift Charts'ın kategori ekseni telefon genişliğinde isimleri ya kırpıyor ya
/// da barın üstüne taşırıyordu. Uzun müdürlük adları okunabilsin diye ad barın
/// üstünde tam olarak yazılır, değer sağa hizalanır; bar da tüm genişliği
/// kullanır. Çok segmentli satırlarda dokunmak kırılımı açar.
struct KBRankedBarList: View {
    struct Segment: Identifiable, Equatable {
        let name: String
        let value: Int
        let color: Color

        var id: String { name }
    }

    struct Row: Identifiable, Equatable {
        let name: String
        let segments: [Segment]

        var id: String { name }
        var total: Int { segments.reduce(0) { $0 + $1.value } }
    }

    let rows: [Row]

    @State private var secilen: String?

    private static let barHeight: CGFloat = 12

    var body: some View {
        let enBuyuk = max(rows.map(\.total).max() ?? 1, 1)

        VStack(alignment: .leading, spacing: 10) {
            ForEach(rows) { row in
                satir(row, enBuyuk: enBuyuk)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: rows)
    }

    private func satir(_ row: Row, enBuyuk: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(row.name)
                    .font(.caption)
                    .foregroundStyle(KBTheme.navy)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text(KBChartFormat.adet(row.total))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
            }

            GeometryReader { geo in
                let genislik = geo.size.width * Double(row.total) / Double(enBuyuk)
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(KBTheme.background)
                    HStack(spacing: 1) {
                        ForEach(row.segments.filter { $0.value > 0 }) { segment in
                            Rectangle()
                                .fill(segment.color)
                                .frame(
                                    width: max(
                                        genislik * Double(segment.value) / Double(max(row.total, 1)) - 1,
                                        1
                                    )
                                )
                        }
                    }
                    .frame(width: max(genislik, 2), alignment: .leading)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                }
            }
            .frame(height: Self.barHeight)

            if secilen == row.name, row.segments.count > 1 {
                kirilim(row)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            guard row.segments.count > 1 else { return }
            KBChartHaptics.selectionChanged()
            secilen = secilen == row.name ? nil : row.name
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(row.name): \(row.total)")
    }

    private func kirilim(_ row: Row) -> some View {
        HStack(spacing: 10) {
            ForEach(row.segments.filter { $0.value > 0 }) { segment in
                HStack(spacing: 4) {
                    Circle()
                        .fill(segment.color)
                        .frame(width: 6, height: 6)
                    Text("\(segment.name) \(KBChartFormat.adet(segment.value))")
                        .font(.system(size: 10))
                        .foregroundStyle(KBTheme.muted)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 2)
    }
}
