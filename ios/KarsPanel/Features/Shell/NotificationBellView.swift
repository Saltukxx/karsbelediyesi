import SwiftUI

struct NotificationBellView: View {
    @State private var okunmamis = 0
    @State private var bildirimler: [NotificationItemDTO] = []
    @State private var hata: String?
    @State private var showList = false

    var body: some View {
        Button {
            showList = true
            Task { await zileBasildi() }
        } label: {
            Image(systemName: okunmamis > 0 ? "bell.badge.fill" : "bell")
                .symbolRenderingMode(.hierarchical)
                .font(.body.weight(.semibold))
                .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
                .overlay(alignment: .topTrailing) {
                    if okunmamis > 0 {
                        Text("\(min(okunmamis, 99))")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(KBTheme.danger)
                            .clipShape(Capsule())
                            .offset(x: -4, y: 6)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(okunmamis > 0 ? "Bildirimler, \(okunmamis) okunmamış" : "Bildirimler")
        .sheet(isPresented: $showList) {
            NotificationListView(bildirimler: bildirimler, hata: hata)
        }
        .task { await yukle() }
        .kbPoll(every: 30) { await yukle() }
    }

    /// Önce okundu işaretlenir, sonra liste tazelenir. İşaretleme hatası tazeleme
    /// başarılı olsa bile korunur; aksi halde kullanıcı rozetin neden inmediğini bilemez.
    private func zileBasildi() async {
        var isaretlemeHatasi: String?
        do {
            try await APIClient.shared.markNotificationsRead(all: true)
        } catch is CancellationError {
            return
        } catch {
            isaretlemeHatasi = KBErrorText.of(error)
        }
        await yukle()
        if let isaretlemeHatasi { hata = isaretlemeHatasi }
    }

    private func yukle() async {
        do {
            let dto = try await APIClient.shared.fetchNotifications()
            okunmamis = dto.unread ?? 0
            bildirimler = dto.items ?? []
            hata = nil
        } catch is CancellationError {
            return
        } catch {
            hata = KBErrorText.of(error)
        }
    }
}

private struct NotificationListView: View {
    let bildirimler: [NotificationItemDTO]
    let hata: String?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Bildirimler")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Kapat")
            }
            .padding(.leading, 16)
            .padding(.trailing, 4)
            .padding(.vertical, 10)
            .background(KBTheme.navy)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if let hata {
                        ErrorBanner(message: hata)
                    }
                    if bildirimler.isEmpty {
                        EmptyStateView(
                            title: "Bildirim yok",
                            systemImage: "bell.slash",
                            message: "Yeni bir olay olduğunda burada göreceksiniz."
                        )
                        .kbCard()
                    } else {
                        ForEach(bildirimler) { bildirim in
                            KBRecordCard(
                                title: bildirim.baslik ?? "Bildirim",
                                subtitle: bildirim.mesaj,
                                meta: KBFormat.tarih(bildirim.createdAt)
                                    .map { [KBMetaChip(icon: "calendar", text: $0)] } ?? [],
                                accent: KBTheme.accent
                            )
                        }
                    }
                }
                .padding(16)
            }
        }
        .kbScreenBackground()
    }
}
