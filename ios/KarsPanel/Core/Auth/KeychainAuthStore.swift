import Foundation
import Security

final class KeychainAuthStore {
    static let shared = KeychainAuthStore()

    private let service = "tr.gov.kars.panel"
    private let tokenKey = "auth_token"
    private let userKey = "auth_user"

    private init() {}

    func saveToken(_ token: String) {
        save(token, account: tokenKey)
    }

    func loadToken() -> String? {
        load(account: tokenKey)
    }

    func saveUser(_ user: UserDTO) {
        guard let data = try? JSONEncoder().encode(user),
              let json = String(data: data, encoding: .utf8) else { return }
        save(json, account: userKey)
    }

    func loadUser() -> UserDTO? {
        guard let json = load(account: userKey),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(UserDTO.self, from: data)
    }

    func clear() {
        delete(account: tokenKey)
        delete(account: userKey)
    }

    private func save(_ value: String, account: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    private func load(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else { return nil }
        return value
    }

    private func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
