import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        Group {
            if session.isBootstrapping {
                ProgressView("Yükleniyor…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(KBTheme.background)
            } else if session.isAuthenticated {
                MainShellView()
            } else {
                LoginView()
            }
        }
        .preferredColorScheme(.light)
    }
}
