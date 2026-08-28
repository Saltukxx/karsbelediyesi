import SwiftUI

/// Liste uçları belli bir satır sayısında kesiyor. Bu kart hem kesildiğini söyler hem de
/// sınırı büyütmenin yolunu verir; aksi halde eksik liste tam görünüyordu.
struct KBLoadMoreCard: View {
    let sayi: Int
    let birim: String
    let isLoading: Bool
    let onLoadMore: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Text("İlk \(sayi) \(birim) gösteriliyor.")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)

            Button(action: onLoadMore) {
                if isLoading {
                    ProgressView()
                } else {
                    Label("Daha fazla yükle", systemImage: "arrow.down.circle")
                        .font(.subheadline.weight(.semibold))
                }
            }
            .buttonStyle(.plain)
            .foregroundStyle(KBTheme.accent)
            .frame(minHeight: KBTheme.touchMin)
            .disabled(isLoading)
        }
        .frame(maxWidth: .infinity)
        .kbCard()
    }
}

/// `KBListStore` kullanan ekranlar için hazır sarmalayıcı.
struct KBLoadMoreRow<Item>: View {
    @ObservedObject var store: KBListStore<Item>
    var birim = "kayıt"

    var body: some View {
        if store.canLoadMore {
            KBLoadMoreCard(
                sayi: store.items.count,
                birim: birim,
                isLoading: store.isLoading
            ) {
                Task { await store.loadMore() }
            }
        }
    }
}
