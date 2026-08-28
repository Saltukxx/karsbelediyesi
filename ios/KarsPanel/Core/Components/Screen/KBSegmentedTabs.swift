import SwiftUI

/// Web panelindeki Tabs karşılığı; çok bölümlü modüllerde (malzeme, beton, bitüm) kullanılır.
struct KBSegmentedTabs<Value: Hashable>: View {
    @Binding var selection: Value
    let items: [KBTabItem<Value>]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(items) { item in
                let selected = selection == item.value
                Button {
                    selection = item.value
                } label: {
                    Text(item.label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(selected ? .white : KBTheme.navy)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 34)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(selected ? KBTheme.navy : Color.clear)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(4)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                .stroke(KBTheme.border, lineWidth: 1)
        )
    }
}

struct KBTabItem<Value: Hashable>: Identifiable {
    let value: Value
    let label: String

    var id: Value { value }
}

/// Kart içi bölüm başlığı; sağda opsiyonel özet metni taşır.
struct KBSectionHeader: View {
    let title: String
    var trailing: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(KBTheme.navy)
            Spacer(minLength: 8)
            if let trailing {
                Text(trailing)
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            }
        }
        .padding(.top, 4)
    }
}
