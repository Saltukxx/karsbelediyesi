import Foundation

@MainActor
final class AppSession: ObservableObject {
    @Published private(set) var user: UserDTO?
    @Published private(set) var isBootstrapping = true

    private let authStore: KeychainAuthStore
    private let api: APIClient

    init(authStore: KeychainAuthStore = .shared, api: APIClient = .shared) {
        self.authStore = authStore
        self.api = api
        bootstrap()
    }

    var isAuthenticated: Bool { user != nil }

    func bootstrap() {
        Task { @MainActor in
            defer { isBootstrapping = false }
            guard let token = authStore.loadToken(),
                  let savedUser = authStore.loadUser() else { return }
            api.setToken(token)
            user = savedUser
        }
    }

    func signIn(user: UserDTO, token: String) {
        authStore.saveToken(token)
        authStore.saveUser(user)
        api.setToken(token)
        self.user = user
    }

    func signOut() {
        authStore.clear()
        api.setToken(nil)
        user = nil
    }
}
