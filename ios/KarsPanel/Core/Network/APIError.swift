import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case forbidden
    case notFound
    /// Canlı sunucuda bu route henüz yok (Next.js HTML 404).
    case endpointMissing
    /// Middleware JWT'yi görmeden /giris'e 307 attı.
    case loginRedirect
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
        case .endpointMissing:
            return "Bu ekranın API'si canlı sunucuda henüz yok. Web paneli güncellenince açılacak."
        case .loginRedirect:
            return "Sunucu telefon oturumunu tarayıcı girişi sandı. Web paneli güncellenince düzelecek."
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
