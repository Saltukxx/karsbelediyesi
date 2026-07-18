import SwiftUI

@main
struct KarsPanelApp: App {
    @StateObject private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .tint(KBTheme.accent)
        }
    }
}
