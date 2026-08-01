import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case forbidden
    case notFound
    case server(Int, String?)
    case decoding(Error)
    case encoding(Error)
    case network(Error)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Geçersiz adres"
        case .unauthorized:
            return "Oturum süresi doldu veya geçersiz kimlik bilgileri"
        case .forbidden:
            return "Bu işlem için yetkiniz yok"
        case .notFound:
            return "Kayıt bulunamadı"
        case let .server(code, message):
            return message ?? "Sunucu hatası (\(code))"
        case let .decoding(error):
            return "Veri okunamadı: \(error.localizedDescription)"
        case let .encoding(error):
            return "İstek hazırlanamadı: \(error.localizedDescription)"
        case let .network(error):
            return "Bağlantı hatası: \(error.localizedDescription)"
        case .unknown:
            return "Bilinmeyen hata"
        }
    }

    /// Oturumun düşmesi gereken hatalar
    var isAuthFailure: Bool {
        if case .unauthorized = self { return true }
        return false
    }

    /// Bağlantı kaynaklı geçici hata: yeniden denemek anlamlı (çevrimdışı kuyruk).
    var isOffline: Bool {
        guard case let .network(underlying) = self else { return false }
        guard let urlError = underlying as? URLError else { return true }
        switch urlError.code {
        case .notConnectedToInternet,
             .networkConnectionLost,
             .cannotConnectToHost,
             .cannotFindHost,
             .timedOut,
             .dataNotAllowed,
             .internationalRoamingOff,
             .dnsLookupFailed:
            return true
        default:
            return false
        }
    }

    static func isOffline(_ error: Error) -> Bool {
        (error as? APIError)?.isOffline ?? false
    }

    /// Görünüm modellerinin hata mesajı üretmek için kullandığı tek nokta.
    static func describe(_ error: Error) -> String {
        if let apiError = error as? APIError {
            return apiError.errorDescription ?? "Bilinmeyen hata"
        }
        return error.localizedDescription
    }
}

struct APIErrorResponse: Decodable {
    let error: String?
}
