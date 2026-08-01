import SwiftUI

/// Araç çubuğundaki bildirim zili — okunmamış sayısını rozet olarak gösterir.
struct NotificationBellButton: View {
    @ObservedObject private var store = NotificationsStore.shared
    @State private var listeAcik = false

    var body: some View {
        Button {
            listeAcik = true
        } label: {
            Image(systemName: store.unread > 0 ? "bell.badge.fill" : "bell")
                .symbolRenderingMode(.hierarchical)
                .font(.title3)
                .foregroundStyle(store.unread > 0 ? KBTheme.accent : KBTheme.navy)
                .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
                .overlay(alignment: .topTrailing) {
                    if store.unread > 0 {
                        Text(store.unread > 99 ? "99+" : String(store.unread))
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(KBTheme.danger)
                            .clipShape(Capsule())
                            .offset(x: -2, y: 4)
                    }
                }
        }
        .accessibilityLabel(
            store.unread > 0
                ? "Bildirimler, \(store.unread) okunmamış"
                : "Bildirimler"
        )
        .sheet(isPresented: $listeAcik) {
            NavigationStack { NotificationCenterView() }
        }
    }
}

/// Bildirim kutusu. Satıra dokunmak bildirimi okundu işaretler ve ilgili
/// ekrana gider (web'deki zil listesiyle aynı davranış).
struct NotificationCenterView: View {
    @EnvironmentObject private var navigator: AppNavigator
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var store = NotificationsStore.shared

    var body: some View {
        List {
            if let errorMessage = store.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if store.items.isEmpty, !store.isLoading {
                Section {
                    EmptyStateView(
                        title: "Bildirim yok",
                        systemImage: "bell",
                        message: "SLA gecikmeleri, atamalar ve rota sapmaları burada görünür."
                    )
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            }

            ForEach(store.items) { bildirim in
                Button {
                    ac(bildirim)
                } label: {
                    NotificationRow(bildirim: bildirim)
                }
                .buttonStyle(.plain)
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle("Bildirimler")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.load() }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
            if store.unread > 0 {
                ToolbarItem(placement: .primaryAction) {
                    Button("Tümünü Oku") { Task { await store.tumunuOku() } }
                }
            }
        }
        .overlay {
            if store.isLoading, store.items.isEmpty { LoadingOverlay() }
        }
        .task { await store.load() }
    }

    private func ac(_ bildirim: NotificationDTO) {
        Task { await store.okunduIsaretle(bildirim) }
        // Hedefi çözülemeyen bildirim yalnızca okundu işaretlenir.
        guard let hedef = bildirim.hedef else { return }
        navigator.ac(hedef)
        dismiss()
    }
}

private struct NotificationRow: View {
    let bildirim: NotificationDTO

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(bildirim.okundu ? Color.clear : KBTheme.accent)
                .frame(width: 8, height: 8)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 4) {
                Text(bildirim.baslik ?? "Bildirim")
                    .font(.subheadline.weight(bildirim.okundu ? .regular : .semibold))
                    .foregroundStyle(KBTheme.navy)
                if let mesaj = bildirim.mesaj, !mesaj.isEmpty {
                    Text(mesaj)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(bildirim.createdAt.kbAn)
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }

            Spacer(minLength: 0)

            if bildirim.hedef != nil {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KBTheme.muted)
                    .padding(.top, 4)
            }
        }
        .padding(.vertical, 4)
    }
}
