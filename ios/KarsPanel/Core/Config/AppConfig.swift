import Foundation

/// Ortam yapılandırması. Taban adres derleme zamanında Info.plist'ten
/// (`KBAPIBaseURL`, xcconfig/build setting ile beslenir) okunur; kullanıcı
/// Ayarlar'dan geçersiz kılabilir (saha testi ve kurum içi dağıtım için).
enum AppConfig {
    /// Info.plist anahtarı — Debug'da localhost, Release'de kurum adresi.
    private static let baseURLKey = "KBAPIBaseURL"
    /// Kullanıcının Ayarlar'dan girdiği adres.
    static let overrideDefaultsKey = "kbApiBaseURLOverride"

    static let fallbackBaseURL = URL(string: "https://karsbelediyesi.gbsoftt.com")!

    /// Info.plist'te tanımlı derleme zamanı adresi.
    static var bundledBaseURL: URL {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: baseURLKey) as? String,
            let url = normalize(raw)
        else {
            return fallbackBaseURL
        }
        return url
    }

    /// Etkin adres: kullanıcı geçersiz kılması varsa o, yoksa derleme zamanı adresi.
    static func resolvedBaseURL(defaults: UserDefaults = .standard) -> URL {
        if let raw = defaults.string(forKey: overrideDefaultsKey), let url = normalize(raw) {
            return url
        }
        return bundledBaseURL
    }

    static func setBaseURLOverride(_ raw: String?, defaults: UserDefaults = .standard) {
        guard let raw, let url = normalize(raw) else {
            defaults.removeObject(forKey: overrideDefaultsKey)
            return
        }
        defaults.set(url.absoluteString, forKey: overrideDefaultsKey)
    }

    /// Şema eksikse https varsayar, yol/sorgu/parça kısmını atar.
    /// Yalnızca http ve https kabul edilir.
    static func normalize(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let withScheme = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        guard var components = URLComponents(string: withScheme) else { return nil }
        guard let scheme = components.scheme, scheme == "http" || scheme == "https" else {
            return nil
        }
        guard let host = components.host, isValidHost(host) else { return nil }

        components.path = ""
        components.query = nil
        components.fragment = nil
        return components.url
    }

    /// URLComponents "!!!" gibi değerleri host olarak kabul eder; alan adı ve
    /// IP dışındaki girdiler burada elenir.
    private static func isValidHost(_ host: String) -> Bool {
        guard !host.isEmpty, host.count <= 253 else { return false }
        guard !host.hasPrefix("-"), !host.hasSuffix("-") else { return false }
        guard !host.hasPrefix("."), !host.hasSuffix(".") else { return false }

        // IPv6 köşeli parantez içinde gelir (URLComponents.host parantezi soyar)
        if host.contains(":") { return host.allSatisfy { $0.isHexDigit || $0 == ":" } }

        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-."))
        guard host.unicodeScalars.allSatisfy(allowed.contains) else { return false }
        // Her etiket en az bir karakter olmalı ("a..b" geçersiz)
        return host.split(separator: ".", omittingEmptySubsequences: false)
            .allSatisfy { !$0.isEmpty }
    }

    static var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        return [version, build].compactMap { $0 }.joined(separator: " (") + (build == nil ? "" : ")")
    }

    /// Sunucu push gönderirken hangi APNs ortamına bağlanacağını bu değere göre
    /// seçer. Debug derlemeleri Apple'ın sandbox'ına kayıt olur.
    static var apnsPlatform: String {
        #if DEBUG
        return "APNS_SANDBOX"
        #else
        return "APNS"
        #endif
    }

    /// Cihaz kaydında saklanan uygulama kimliği ("KarsPanel 1.0.0 (12)").
    static var surumEtiketi: String { "KarsPanel \(appVersion)" }
}
