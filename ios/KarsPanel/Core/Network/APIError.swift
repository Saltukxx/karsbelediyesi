import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case forbidden
    case notFound
    case server(Int, String?)
    case decoding(Error)
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
        case let .network(error):
            return "Bağlantı hatası: \(error.localizedDescription)"
        case .unknown:
            return "Bilinmeyen hata"
        }
    }
}

struct APIErrorResponse: Decodable {
    let error: String?
}
