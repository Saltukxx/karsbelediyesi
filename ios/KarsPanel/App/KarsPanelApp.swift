import SwiftUI
import UIKit

@main
struct KarsPanelApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session = AppSession()
    @StateObject private var navigator = AppNavigator()
    @ObservedObject private var push = PushService.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(navigator)
                .tint(KBTheme.accent)
                // Push'a dokunulduğunda hedef kabuğa iletilir; oturum yoksa
                // giriş sonrası tekrar denenmesin diye burada temizlenir.
                .onChange(of: push.bekleyenHedef) { _, hedef in
                    guard let hedef else { return }
                    push.bekleyenHedef = nil
                    guard session.isAuthenticated else { return }
                    navigator.ac(hedef)
                }
                .onChange(of: session.isAuthenticated) { _, giris in
                    giris ? push.oturumAcildi() : push.oturumKapandi()
                }
                .task {
                    if session.isAuthenticated { push.oturumAcildi() }
                }
        }
    }
}

/// APNs geri çağrıları yalnızca `UIApplicationDelegate` üzerinden gelir;
/// SwiftUI'nin kendi karşılığı yok.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in PushService.shared.tokenAlindi(deviceToken) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in PushService.shared.kayitBasarisiz(error) }
    }
}
