import SwiftUI

struct KBBadge: Hashable {
    let text: String
    var tone: StatusBadge.Tone = .neutral
}

struct KBMetaChip: Identifiable, Hashable {
    var icon: String
    var text: String

    var id: String { "\(icon)-\(text)" }
}

struct KBRecordAction: Identifiable {
    enum Kind {
        case normal, primary, destructive
    }

    let id: String
    let title: String
    var icon: String? = nil
    var kind: Kind = .normal
    let handler: () -> Void
}

/// Web tablo satırının mobil karşılığı: başlık, durum rozetleri, meta çipleri ve aksiyon şeridi.
struct KBRecordCard: View {
    let title: String
    var badges: [KBBadge] = []
    var subtitle: String? = nil
    var meta: [KBMetaChip] = []
    var actions: [KBRecordAction] = []
    var accent: Color = KBTheme.navy
    var showsChevron = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(KBTheme.navy)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 4)
                ForEach(badges, id: \.self) { badge in
                    StatusBadge(text: badge.text, tone: badge.tone)
                }
                if showsChevron {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KBTheme.muted)
                }
            }

            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !meta.isEmpty {
                KBMetaChipRow(chips: meta)
            }

            if !actions.isEmpty {
                Divider().overlay(KBTheme.border)
                HStack(spacing: 8) {
                    ForEach(actions) { action in
                        KBRecordActionButton(action: action)
                    }
                    Spacer(minLength: 0)
                }
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
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(accent)
                .frame(width: 3)
                .padding(.vertical, 12)
        }
        .contentShape(Rectangle())
    }
}

struct KBMetaChipRow: View {
    let chips: [KBMetaChip]

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(chips) { chip in
                HStack(spacing: 4) {
                    Image(systemName: chip.icon)
                        .font(.system(size: 10, weight: .semibold))
                    Text(chip.text)
                        .font(.caption2.weight(.medium))
                        .lineLimit(1)
                }
                .foregroundStyle(KBTheme.muted)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(KBTheme.background)
                .clipShape(Capsule())
            }
        }
    }
}

private struct KBRecordActionButton: View {
    let action: KBRecordAction

    var body: some View {
        Button(action: action.handler) {
            HStack(spacing: 5) {
                if let icon = action.icon {
                    Image(systemName: icon)
                        .font(.system(size: 11, weight: .bold))
                }
                Text(action.title)
                    .font(.caption.weight(.semibold))
            }
            .foregroundStyle(foreground)
            .padding(.horizontal, 12)
            .frame(minHeight: 32)
            .background(background)
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(borderColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var foreground: Color {
        switch action.kind {
        case .normal: return KBTheme.navy
        case .primary: return .white
        case .destructive: return KBTheme.danger
        }
    }

    private var background: Color {
        switch action.kind {
        case .normal: return KBTheme.background
        case .primary: return KBTheme.action
        case .destructive: return KBTheme.danger.opacity(0.1)
        }
    }

    private var borderColor: Color {
        switch action.kind {
        case .normal: return KBTheme.border
        case .primary: return .clear
        case .destructive: return KBTheme.danger.opacity(0.25)
        }
    }
}

/// Meta çipleri satıra sığmadığında alta kaydıran basit akış yerleşimi.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let rows = arrange(subviews: subviews, maxWidth: maxWidth)
        let height = rows.reduce(CGFloat.zero) { $0 + $1.height } + spacing * CGFloat(max(rows.count - 1, 0))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: min(width, maxWidth), height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        let rows = arrange(subviews: subviews, maxWidth: bounds.width)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(
                    at: CGPoint(x: x, y: y),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(size)
                )
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(subviews: Subviews, maxWidth: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let projected = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            if projected > maxWidth, !current.indices.isEmpty {
                rows.append(current)
                current = Row()
                current.indices = [index]
                current.width = size.width
                current.height = size.height
            } else {
                current.indices.append(index)
                current.width = projected
                current.height = max(current.height, size.height)
            }
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
