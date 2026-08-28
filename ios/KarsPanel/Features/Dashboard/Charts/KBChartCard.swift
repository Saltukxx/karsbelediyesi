import SwiftUI

/// Tüm dashboard grafiklerinin ortak çerçevesi: başlık, açıklama ve boş durum.
///
/// Web'deki `ChartCard` gibi, veri yokken grafik yüksekliği rezerve edilmez;
/// aksi halde boş bir dashboard baştan aşağı ölü alanla dolar.
struct KBChartCard<Content: View>: View {
    let title: String
    var description: String? = nil
    var isEmpty: Bool = false
    var emptyText: String = "Seçili dönemde veri yok"
    var destination: NavDestination? = nil
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            if isEmpty {
                KBChartEmptyState(text: emptyText)
            } else {
                content()
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                .stroke(KBTheme.border, lineWidth: 1)
        )
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
                if let description {
                    Text(description)
                        .font(.caption2)
                        .foregroundStyle(KBTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 0)

            if let destination {
                NavigationLink {
                    DestinationView(destination: destination)
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KBTheme.muted)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(title) detayı")
            }
        }
    }
}

struct KBChartEmptyState: View {
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "chart.bar")
                .font(.subheadline)
                .foregroundStyle(KBTheme.muted.opacity(0.7))
            Text(text)
                .font(.subheadline)
                .foregroundStyle(KBTheme.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 64)
    }
}

/// Grafiklerin altında yer alan okunabilir açıklama satırı.
struct KBChartLegend: View {
    struct Item: Identifiable {
        let name: String
        let value: String
        let color: Color

        var id: String { name }
    }

    let items: [Item]
    var columns: Int = 2

    var body: some View {
        LazyVGrid(
            columns: Array(
                repeating: GridItem(.flexible(), spacing: 10, alignment: .leading),
                count: columns
            ),
            alignment: .leading,
            spacing: 6
        ) {
            ForEach(items) { item in
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(item.color)
                        .frame(width: 9, height: 9)
                    Text(item.name)
                        .font(.caption2)
                        .foregroundStyle(KBTheme.muted)
                        .lineLimit(1)
                    Spacer(minLength: 2)
                    Text(item.value)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(KBTheme.navy)
                }
            }
        }
    }
}
