import Foundation
import UIKit
import UserNotifications

/// APNs izin + token kayıt. Sunucu env eksikse no-op; poll yedek kalır.
@MainActor
final class PushRegistration: NSObject {
    static let shared = PushRegistration()

    private var lastSentToken: String?

    func requestAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    func handleDeviceToken(_ deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        guard !hex.isEmpty, hex != lastSentToken else { return }
        lastSentToken = hex
        Task {
            do {
                try await APIClient.shared.registerDevice(token: hex, platform: "ios")
            } catch {
                // Kayıt başarısızsa bir sonraki login/aktif olunca tekrar dener
                lastSentToken = nil
            }
        }
    }

    func handleRegistrationFailure(_ error: Error) {
        print("[push] kayıt başarısız: \(error.localizedDescription)")
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            PushRegistration.shared.handleDeviceToken(deviceToken)
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in
            PushRegistration.shared.handleRegistrationFailure(error)
        }
    }

    // Ön plandayken de banner göster (poll ile çakışmaz)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }
}
