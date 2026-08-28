import SwiftUI
import UIKit

/// Dokunmatik seçimde grafiklerin üstünde beliren bilgi kartı.
/// Görünüm web'deki ECharts tooltip'iyle aynı: beyaz zemin, ince kenarlık, gölge.
struct KBChartTooltip: View {
    struct Row: Identifiable {
        let label: String
        let value: String
        var color: Color? = nil

        var id: String { label }
    }

    let title: String
    let rows: [Row]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(KBTheme.navy)

            ForEach(rows) { row in
                HStack(spacing: 6) {
                    if let color = row.color {
                        Circle()
                            .fill(color)
                            .frame(width: 7, height: 7)
                    }
                    Text(row.label)
                        .font(.caption2)
                        .foregroundStyle(KBTheme.muted)
                    Text(row.value)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(KBTheme.navy)
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(KBTheme.card)
                .shadow(color: KBTheme.navy.opacity(0.16), radius: 8, y: 3)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(KBTheme.border, lineWidth: 1)
        )
        .fixedSize()
    }
}

/// Seçim değiştiğinde tek bir hafif dokunuş geri bildirimi verir.
@MainActor
enum KBChartHaptics {
    private static let generator = UISelectionFeedbackGenerator()

    static func selectionChanged() {
        generator.selectionChanged()
    }
}
