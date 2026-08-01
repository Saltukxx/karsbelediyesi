import Foundation

@MainActor
final class AppSession: ObservableObject {
    @Published private(set) var user: UserDTO?
    @Published private(set) var isBootstrapping = true
    /// Token süresi dolduğunda kullanıcıya gösterilecek bilgi
    @Published var sessionExpiredMessage: String?

    private let authStore: KeychainAuthStore
    private let api: APIClient
    private let defaults: UserDefaults

    init(
        authStore: KeychainAuthStore = .shared,
        api: APIClient = .shared,
        defaults: UserDefaults = .standard
    ) {
        self.authStore = authStore
        self.api = api
        self.defaults = defaults

        // Sunucu 401 döndüğünde (token süresi doldu) oturumu düşür
        api.onUnauthorized = { [weak self] in
            self?.handleUnauthorized()
        }
        bootstrap()
    }

    var isAuthenticated: Bool { user != nil }

    var baseURL: URL { api.baseURL }

    /// Oturum yoksa en kısıtlı rol varsayılır; ekranlar yazma düğmelerini buna göre saklar.
    var role: UserRole { user?.role ?? .FIELD_WORKER }

    /// Yazma yetkisi olan yönetici rolleri (web `authz` ile aynı küme).
    var canManageOperations: Bool {
        role == .ADMIN || role == .DEPARTMENT_MANAGER
    }

    /// Sunucu fotoğraf yollarını köke göreli döner (`/uploads/...`); mutlak
    /// adresler olduğu gibi kullanılır.
    func mediaURL(_ path: String) -> URL? {
        if let absolute = URL(string: path), absolute.scheme != nil { return absolute }
        return URL(string: path, relativeTo: api.baseURL)
    }

    func bootstrap() {
        Task { @MainActor in
            defer { isBootstrapping = false }
            api.setBaseURL(AppConfig.resolvedBaseURL(defaults: defaults))
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
        sessionExpiredMessage = nil
        self.user = user
    }

    func signOut() {
        authStore.clear()
        api.setToken(nil)
        user = nil
        // Açılır listeler role/müdürlüğe göre kapsamlı; yeni oturumda yeniden çekilir
        LookupStore.shared.clear()
    }

    /// Sunucu adresini değiştirir; farklı kuruma bağlanmak oturumu geçersiz kılar.
    func updateBaseURL(_ raw: String?) {
        AppConfig.setBaseURLOverride(raw, defaults: defaults)
        let resolved = AppConfig.resolvedBaseURL(defaults: defaults)
        guard resolved != api.baseURL else { return }
        api.setBaseURL(resolved)
        signOut()
    }

    private func handleUnauthorized() {
        guard user != nil else { return }
        signOut()
        sessionExpiredMessage = "Oturum süresi doldu, lütfen yeniden giriş yapın."
    }
}
