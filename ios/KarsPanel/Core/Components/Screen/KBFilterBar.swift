import SwiftUI

/// Web panelindeki StickyFilter arama kutusunun karşılığı.
struct KBSearchField: View {
    @Binding var text: String
    var placeholder: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(KBTheme.muted)
            TextField(placeholder, text: $text)
                .font(.subheadline)
                .foregroundStyle(KBTheme.navy)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(KBTheme.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Aramayı temizle")
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: KBTheme.touchMin)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                .stroke(KBTheme.border, lineWidth: 1)
        )
    }
}

/// Web panelindeki FilterChips karşılığı: yatay kaydırılabilir tekli seçim.
struct KBChipRow<Value: Hashable>: View {
    @Binding var selection: Value
    let items: [KBChipItem<Value>]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items) { item in
                    let selected = selection == item.value
                    Button {
                        selection = item.value
                    } label: {
                        HStack(spacing: 5) {
                            Text(item.label)
                                .font(.caption.weight(.semibold))
                            if let count = item.count {
                                Text("\(count)")
                                    .font(.caption2.weight(.bold))
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(selected ? Color.white.opacity(0.22) : KBTheme.navy.opacity(0.08))
                                    .clipShape(Capsule())
                            }
                        }
                        .foregroundStyle(selected ? .white : KBTheme.navy)
                        .padding(.horizontal, 12)
                        .frame(minHeight: 34)
                        .background(selected ? KBTheme.action : KBTheme.card)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().stroke(KBTheme.border, lineWidth: selected ? 0 : 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(.horizontal, 1)
        }
    }
}

struct KBChipItem<Value: Hashable>: Identifiable {
    let value: Value
    let label: String
    var count: Int? = nil

    var id: Value { value }
}
