import Foundation

@MainActor
final class AppSession: ObservableObject {
    @Published private(set) var user: UserDTO?
    @Published private(set) var moduleHrefs: [String]?
    @Published private(set) var isBootstrapping = true

    private let authStore: KeychainAuthStore
    private let api: APIClient

    init(authStore: KeychainAuthStore = .shared, api: APIClient = .shared) {
        self.authStore = authStore
        self.api = api
        APIClient.onUnauthorized = { [weak self] in
            self?.signOut()
        }
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
            await refreshMe()
        }
    }

    func signIn(user: UserDTO, token: String) {
        authStore.saveToken(token)
        authStore.saveUser(user)
        api.setToken(token)
        // Referans listeleri role göre süzülüyor; önceki kullanıcının kopyası kalmasın.
        KBReferenceCache.shared.temizle()
        self.user = user
        Task { await refreshMe() }
    }

    func signOut() {
        authStore.clear()
        api.setToken(nil)
        KBReferenceCache.shared.temizle()
        user = nil
        moduleHrefs = nil
    }

    func refreshMe() async {
        do {
            let me = try await api.fetchMe()
            user = me.user
            moduleHrefs = me.moduleHrefs
            authStore.saveUser(me.user)
        } catch let error as APIError {
            switch error {
            case .notFound, .endpointMissing:
                moduleHrefs = nil
            case .unauthorized, .forbidden, .loginRedirect, .invalidURL, .server, .decoding, .network, .unknown:
                break
            }
        } catch {
            // Token geçersizse 401 zaten signOut tetikler
        }
    }
}
