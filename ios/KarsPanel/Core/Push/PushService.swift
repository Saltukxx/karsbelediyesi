import UIKit
import UserNotifications

/// APNs kaydı ve gelen bildirimlerin yönlendirilmesi.
///
/// Token cihaza aittir: uygulama her açılışta ve oturum değiştikçe sunucuya
/// yeniden kaydeder, çıkışta pasifleştirir. Böylece aynı telefonu kullanan iki
/// personelden yalnızca oturumu açık olan bildirim alır.
@MainActor
final class PushService: NSObject, ObservableObject {
    static let shared = PushService()

    @Published private(set) var izinDurumu: UNAuthorizationStatus = .notDetermined
    /// Bildirime dokunulduğunda açılacak ekran; kabuk okuyup temizler.
    @Published var bekleyenHedef: KBDeepLink?

    private let api: APIClient
    private let merkez: UNUserNotificationCenter
    /// APNs'ten gelen ham token (hex). Oturum açılmadan gelirse saklanır.
    private var cihazToken: String?
    private var oturumAcik = false

    init(api: APIClient = .shared, merkez: UNUserNotificationCenter = .current()) {
        self.api = api
        self.merkez = merkez
        super.init()
        merkez.delegate = self
    }

    /// Oturum açıldığında çağrılır: izin istenir, token varsa hemen kaydedilir.
    func oturumAcildi() {
        oturumAcik = true
        Task {
            await izinIste()
            await tokenKaydet()
        }
    }

    /// Çıkışta cihazı pasifleştirir; token cihazda kalır, sonraki girişte
    /// yeni kullanıcıya devredilir.
    func oturumKapandi() {
        oturumAcik = false
        bekleyenHedef = nil
        rozetiTemizle()
        guard let cihazToken else { return }
        Task {
            // Çıkış akışını bekletmemek için hata yutulur; token zaten
            // sunucuda yeni bir kullanıcıya devredilecek.
            try? await api.unregisterDevice(token: cihazToken)
        }
    }

    func izinIste() async {
        do {
            let verildi = try await merkez.requestAuthorization(
                options: [.alert, .sound, .badge]
            )
            izinDurumu = await merkez.notificationSettings().authorizationStatus
            guard verildi else { return }
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            izinDurumu = await merkez.notificationSettings().authorizationStatus
        }
    }

    // MARK: - AppDelegate köprüsü

    func tokenAlindi(_ data: Data) {
        cihazToken = data.map { String(format: "%02x", $0) }.joined()
        Task { await tokenKaydet() }
    }

    func kayitBasarisiz(_ error: Error) {
        // Simulator'da APNs yok; bildirimsiz çalışmaya devam edilir.
        cihazToken = nil
        print("APNs kaydı başarısız: \(error.localizedDescription)")
    }

    /// Rozet, okunmamış bildirim sayısıyla eşitlenir (web'deki zil sayacı).
    func rozetGuncelle(_ okunmamis: Int) {
        merkez.setBadgeCount(max(0, okunmamis))
    }

    private func rozetiTemizle() {
        merkez.setBadgeCount(0)
    }

    private func tokenKaydet() async {
        guard oturumAcik, let cihazToken, api.hasToken else { return }
        do {
            try await api.registerDevice(
                DeviceRegisterRequestDTO(
                    token: cihazToken,
                    platform: AppConfig.apnsPlatform,
                    uygulama: AppConfig.surumEtiketi,
                    cihaz: UIDevice.current.model
                )
            )
        } catch {
            // Kayıt bir sonraki açılışta yeniden denenir; bildirim olmadan
            // uygulama çalışmaya devam eder.
            print("Cihaz kaydı başarısız: \(APIError.describe(error))")
        }
    }

}

extension PushService: UNUserNotificationCenterDelegate {
    /// Uygulama ön plandayken de banner gösterilir; kullanıcı komuta ekranına
    /// bakarken gelen SLA uyarısını kaçırmasın.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        // Yükten yalnızca href okunur: sözlüğün kendisi Sendable değil,
        // aktör sınırını geçirmek yerine burada çözülür.
        let href = response.notification.request.content.userInfo["href"] as? String
        let hedef = href.flatMap(KBDeepLink.init(href:))
        await MainActor.run {
            bekleyenHedef = hedef
        }
    }
}
