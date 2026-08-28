import SwiftUI

struct KBHeaderAction {
    let title: String
    var icon: String = "plus"
    let handler: () -> Void
}

/// Web panelindeki PageHeader karşılığı: başlık, açıklama ve birincil aksiyon.
struct KBPageHeader: View {
    let title: String
    var description: String? = nil
    var action: KBHeaderAction? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(KBTheme.navy)
                    .fixedSize(horizontal: false, vertical: true)
                if let description {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 8)
            if let action {
                Button(action: action.handler) {
                    HStack(spacing: 6) {
                        Image(systemName: action.icon)
                            .font(.caption.weight(.bold))
                        Text(action.title)
                            .font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .frame(minHeight: 38)
                    .background(KBTheme.action)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(action.title)
            }
        }
        .padding(.bottom, 2)
    }
}
