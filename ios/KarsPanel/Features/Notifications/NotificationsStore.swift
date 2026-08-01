import Foundation

/// Bildirim kutusunun tek kaynağı. Zil rozeti her ekranda göründüğü için
/// kabuk düzeyinde paylaşılır; aksi halde her ekran kendi 30 sn'lik döngüsünü
/// açar ve sunucu gereksiz yüklenir.
@MainActor
final class NotificationsStore: ObservableObject {
    static let shared = NotificationsStore()

    @Published private(set) var unread = 0
    @Published private(set) var items: [NotificationDTO] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient
    private let push: PushService
    private let poller = KBPoller(channel: .bildirim)

    init(api: APIClient = .shared, push: PushService = .shared) {
        self.api = api
        self.push = push
    }

    func load() async {
        guard api.hasToken else { return }
        if items.isEmpty { isLoading = true }
        do {
            let liste = try await api.fetchNotifications()
            items = liste.items
            rozetiEsitle(liste.unread)
            errorMessage = nil
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func pollingBaslat(phase: KBAppPhase) {
        poller.sync(phase: phase, ekranGorunur: true) { [weak self] in
            await self?.load()
        }
    }

    func pollingDurdur() {
        poller.stop()
    }

    func okunduIsaretle(_ bildirim: NotificationDTO) async {
        guard !bildirim.okundu else { return }
        do {
            let sonuc = try await api.markNotificationRead(id: bildirim.id)
            rozetiEsitle(sonuc.unread)
            // Sunucuya ikinci bir tur atmadan satırı yerinde günceller.
            items = items.map { $0.id == bildirim.id ? $0.okunduKopyasi : $0 }
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    func tumunuOku() async {
        do {
            let sonuc = try await api.markAllNotificationsRead()
            rozetiEsitle(sonuc.unread)
            items = items.map(\.okunduKopyasi)
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    /// Oturum kapanınca sayaç ve liste sıfırlanır; sonraki kullanıcı öncekinin
    /// bildirimlerini görmez.
    func temizle() {
        poller.stop()
        items = []
        rozetiEsitle(0)
        errorMessage = nil
    }

    private func rozetiEsitle(_ yeni: Int) {
        unread = yeni
        push.rozetGuncelle(yeni)
    }
}

private extension NotificationDTO {
    var okunduKopyasi: NotificationDTO {
        NotificationDTO(
            id: id,
            tip: tip,
            baslik: baslik,
            mesaj: mesaj,
            href: href,
            okundu: true,
            createdAt: createdAt
        )
    }
}
