import SwiftUI

/// Modül ekranlarının ortak iskeleti: yükleme/hata/boş durum, aşağı çekerek
/// yenileme, arama alanı ve sağ üstte "yeni kayıt" düğmesi.
struct KBModuleScreen<Content: View>: View {
    let title: String
    var icon: String
    var isLoading: Bool
    var errorMessage: String?
    var isEmpty: Bool
    var emptyMessage: String = "Bu modülde gösterilecek kayıt yok. Aşağı çekerek yenileyin."
    var searchText: Binding<String>?
    var searchPrompt = "Ara"
    var newItemLabel: String?
    var onNewItem: (() -> Void)?
    var onRefresh: () async -> Void
    @ViewBuilder var content: () -> Content

    var body: some View {
        List {
            if let errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if isEmpty, !isLoading {
                Section {
                    EmptyStateView(
                        title: "Kayıt bulunamadı",
                        systemImage: icon,
                        message: emptyMessage,
                        actionTitle: newItemLabel,
                        action: onNewItem
                    )
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            } else {
                content()
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .modifier(KBSearchable(text: searchText, prompt: searchPrompt))
        .toolbar {
            if let onNewItem, let newItemLabel {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: onNewItem) {
                        Label(newItemLabel, systemImage: "plus")
                    }
                    .accessibilityLabel(newItemLabel)
                }
            }
        }
        .refreshable { await onRefresh() }
        .overlay {
            if isLoading, isEmpty { LoadingOverlay() }
        }
    }
}

/// `searchable` yalnızca arama isteyen ekranlarda uygulanır.
private struct KBSearchable: ViewModifier {
    let text: Binding<String>?
    let prompt: String

    func body(content: Content) -> some View {
        if let text {
            content.searchable(text: text, prompt: prompt)
        } else {
            content
        }
    }
}

/// Liste satırı: başlık, ikincil satırlar ve sağda durum etiketi.
struct KBListRow: View {
    let title: String
    var subtitle: String?
    var detail: String?
    var badge: String?
    var badgeTone: StatusBadge.Tone = .neutral
    var trailingValue: String?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
                    .lineLimit(2)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                        .lineLimit(2)
                }
                if let detail, !detail.isEmpty {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 6) {
                if let trailingValue {
                    Text(trailingValue)
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundStyle(KBTheme.navy)
                }
                if let badge {
                    StatusBadge(text: badge, tone: badgeTone)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Detay ekranlarındaki etiket–değer satırı.
struct KBDetailRow: View {
    let label: String
    let value: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(KBTheme.muted)
            Spacer(minLength: 12)
            Text(value?.isEmpty == false ? value! : "—")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(KBTheme.navy)
                .multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Özet kartı (toplam litre, toplam tutar, kritik stok sayısı…).
struct KBStatTile: View {
    let label: String
    let value: String
    var tone: StatusBadge.Tone = .neutral

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
            Text(value)
                .font(.headline.monospacedDigit())
                .foregroundStyle(tone.foreground)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(KBTheme.background)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
    }
}

struct KBStatRow: View {
    let tiles: [KBStat]

    var body: some View {
        LazyVGrid(columns: [.init(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
            ForEach(tiles) { tile in
                KBStatTile(label: tile.label, value: tile.value, tone: tile.tone)
            }
        }
    }
}

struct KBStat: Identifiable {
    let label: String
    let value: String
    var tone: StatusBadge.Tone = .neutral
    var id: String { label }
}
