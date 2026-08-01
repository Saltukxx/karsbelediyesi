import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case put = "PUT"
    case delete = "DELETE"
}

/// Tek bir HTTP çağrısının tanımı. Yol + sorgu + metot bir arada tutulur;
/// böylece endpoint listeleri testlerde doğrulanabilir.
struct Endpoint {
    var path: String
    var method: HTTPMethod = .get
    var query: [URLQueryItem] = []
    /// Bearer başlığı eklenir mi (login hariç her yerde true)
    var authenticated: Bool = true

    init(
        _ path: String,
        method: HTTPMethod = .get,
        query: [URLQueryItem] = [],
        authenticated: Bool = true
    ) {
        self.path = path
        self.method = method
        self.query = query
        self.authenticated = authenticated
    }

    func adding(_ items: [URLQueryItem?]) -> Endpoint {
        var copy = self
        copy.query.append(contentsOf: items.compactMap { $0 })
        return copy
    }
}

extension URLQueryItem {
    /// Boş/nil değerler sorguya eklenmez.
    static func optional(_ name: String, _ value: String?) -> URLQueryItem? {
        guard let value, !value.isEmpty else { return nil }
        return URLQueryItem(name: name, value: value)
    }

    static func optional(_ name: String, _ value: Int?) -> URLQueryItem? {
        guard let value else { return nil }
        return URLQueryItem(name: name, value: String(value))
    }

    static func optional(_ name: String, _ value: Double?) -> URLQueryItem? {
        guard let value else { return nil }
        return URLQueryItem(name: name, value: String(value))
    }

    static func optional(_ name: String, _ value: Bool?) -> URLQueryItem? {
        guard let value else { return nil }
        return URLQueryItem(name: name, value: value ? "1" : "0")
    }

    /// Sunucu tarih filtrelerini `YYYY-MM-DD` bekler.
    static func optionalDate(_ name: String, _ value: Date?) -> URLQueryItem? {
        guard let value else { return nil }
        return URLQueryItem(name: name, value: DateFormatter.apiDay.string(from: value))
    }
}

/// Sayfalı liste yanıtı. Sunucu düz dizi döndüğünde `PagedResponse` yerine
/// doğrudan `[T]` çözümlenir; sayfalama eklenen uçlarda bu sarmalayıcı kullanılır.
struct PagedResponse<T: Decodable>: Decodable {
    let items: [T]
    let total: Int
    let page: Int
    let pageSize: Int

    var hasMore: Bool { page * pageSize < total }
}

struct PageRequest {
    var page: Int = 1
    var pageSize: Int = 50

    var queryItems: [URLQueryItem] {
        [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "pageSize", value: String(pageSize)),
        ]
    }

    var next: PageRequest { PageRequest(page: page + 1, pageSize: pageSize) }
}

/// İndirilen ikili içerik (Excel export, fotoğraf, WhatsApp medyası).
struct DownloadedFile {
    let data: Data
    let filename: String
    let mimeType: String
}

/// multipart/form-data gövdesi için tek parça.
struct MultipartPart {
    let name: String
    let filename: String?
    let mimeType: String?
    let data: Data

    static func field(_ name: String, _ value: String) -> MultipartPart {
        MultipartPart(name: name, filename: nil, mimeType: nil, data: Data(value.utf8))
    }

    static func file(
        _ name: String,
        filename: String,
        mimeType: String,
        data: Data
    ) -> MultipartPart {
        MultipartPart(name: name, filename: filename, mimeType: mimeType, data: data)
    }
}

extension DateFormatter {
    static let apiDay: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Europe/Istanbul")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}
