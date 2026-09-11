import SwiftUI

@main
struct KarsPanelApp: App {
    @StateObject private var session = AppSession()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(OfflineMutationQueue.shared)
                .tint(KBTheme.accent)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await OfflineMutationQueue.shared.flush() }
            }
        }
    }
}
