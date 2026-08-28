import SwiftUI

/// Web panelindeki StatCard karşılığı; ekran başlarındaki KPI şeritlerinde kullanılır.
struct KBStatCard: View {
    let value: String
    let label: String
    var icon: String? = nil
    var tone: Color = KBTheme.navy
    var hint: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(tone)
                        .frame(width: 22, height: 22)
                        .background(tone.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                Spacer(minLength: 0)
            }
            Text(value)
                .font(.system(size: 21, weight: .bold, design: .rounded))
                .foregroundStyle(tone)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(KBTheme.navy)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            if let hint {
                Text(hint)
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
                    .lineLimit(1)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                .stroke(KBTheme.border, lineWidth: 1)
        )
    }
}

/// KPI kartlarını iki sütunlu ızgaraya dizer.
struct KBStatGrid<Content: View>: View {
    var columns = 2
    @ViewBuilder var content: () -> Content

    var body: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: columns),
            spacing: 10
        ) {
            content()
        }
    }
}
