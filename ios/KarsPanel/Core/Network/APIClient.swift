import Foundation

/// Boş gövdeli yanıtlar için (204 / `{ "ok": true }`).
struct EmptyResponse: Decodable {
    init() {}
    init(from decoder: Decoder) throws { _ = decoder }
}

@MainActor
final class APIClient: ObservableObject {
    static let shared = APIClient()

    @Published private(set) var baseURL: URL
    private var token: String?
    private let session: URLSession

    /// 401 alındığında oturumu düşürmek için AppSession tarafından atanır.
    var onUnauthorized: (@MainActor () -> Void)?

    init(session: URLSession = .shared, baseURL: URL = AppConfig.resolvedBaseURL()) {
        self.session = session
        self.baseURL = baseURL
    }

    func setToken(_ token: String?) {
        self.token = token
    }

    var hasToken: Bool { token != nil }

    func setBaseURL(_ url: URL) {
        baseURL = url
    }

    // MARK: - JSON

    /// Gövdesiz istek (GET / DELETE / gövde gerektirmeyen POST).
    func fetch<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        try decode(await perform(endpoint, payload: nil))
    }

    /// JSON gövdeli istek.
    func send<T: Decodable>(_ endpoint: Endpoint, body: some Encodable) async throws -> T {
        let data = try encodeBody(body)
        return try decode(await perform(endpoint, payload: .json(data)))
    }

    /// Gövdesiz, yanıtı kullanılmayan istek (start/close gibi eylemler).
    @discardableResult
    func call(_ endpoint: Endpoint) async throws -> Data {
        await perform(endpoint, payload: nil).data
    }

    // MARK: - multipart/form-data

    /// Fotoğraflı kayıtlar (yol engeli vb.) için çok parçalı yükleme.
    func upload<T: Decodable>(
        _ endpoint: Endpoint,
        parts: [MultipartPart]
    ) async throws -> T {
        let boundary = "KarsPanel-\(UUID().uuidString)"
        let body = Self.multipartBody(parts: parts, boundary: boundary)
        return try decode(await perform(endpoint, payload: .multipart(body, boundary)))
    }

    // MARK: - Binary

    /// Excel export / fotoğraf indirme. Hata durumunda JSON gövdesi çözümlenir.
    func download(_ endpoint: Endpoint) async throws -> DownloadedFile {
        let result = await perform(endpoint, payload: nil)
        let response = try validate(result)
        return DownloadedFile(
            data: result.data,
            filename: Self.filename(from: response, fallbackPath: endpoint.path),
            mimeType: response.value(forHTTPHeaderField: "Content-Type")
                ?? "application/octet-stream"
        )
    }

    // MARK: - Transport

    private enum Payload {
        case json(Data)
        case multipart(Data, String)
    }

    private struct RawResult {
        let data: Data
        let response: URLResponse?
        let transportError: Error?
    }

    private func perform(_ endpoint: Endpoint, payload: Payload?) async -> RawResult {
        guard let url = makeURL(endpoint) else {
            return RawResult(data: Data(), response: nil, transportError: APIError.invalidURL)
        }

        var req = URLRequest(url: url)
        req.httpMethod = endpoint.method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        switch payload {
        case let .json(data):
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = data
        case let .multipart(data, boundary):
            req.setValue(
                "multipart/form-data; boundary=\(boundary)",
                forHTTPHeaderField: "Content-Type"
            )
            req.httpBody = data
        case nil:
            break
        }

        if endpoint.authenticated, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await session.data(for: req)
            return RawResult(data: data, response: response, transportError: nil)
        } catch {
            return RawResult(data: Data(), response: nil, transportError: error)
        }
    }

    /// Durum kodunu APIError'a çevirir; 401'de oturum düşürme kancasını tetikler.
    private func validate(_ result: RawResult) throws -> HTTPURLResponse {
        if let transportError = result.transportError {
            if let apiError = transportError as? APIError { throw apiError }
            throw APIError.network(transportError)
        }
        guard let http = result.response as? HTTPURLResponse else {
            throw APIError.unknown
        }

        switch http.statusCode {
        case 200...299:
            return http
        case 401:
            onUnauthorized?()
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        default:
            throw APIError.server(http.statusCode, serverMessage(result.data))
        }
    }

    private func decode<T: Decodable>(_ result: RawResult) throws -> T {
        _ = try validate(result)

        // 204 / boş gövde: yanıtı kullanmayan çağrılar EmptyResponse ister.
        if result.data.isEmpty, let empty = EmptyResponse() as? T {
            return empty
        }

        do {
            return try JSONDecoder.api.decode(T.self, from: result.data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func encodeBody(_ body: some Encodable) throws -> Data {
        do {
            return try JSONEncoder.api.encode(body)
        } catch {
            throw APIError.encoding(error)
        }
    }

    private func serverMessage(_ data: Data) -> String? {
        (try? JSONDecoder.api.decode(APIErrorResponse.self, from: data))?.error
    }

    func makeURL(_ endpoint: Endpoint) -> URL? {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return nil
        }
        components.path = endpoint.path.hasPrefix("/") ? endpoint.path : "/\(endpoint.path)"
        components.queryItems = endpoint.query.isEmpty ? nil : endpoint.query
        return components.url
    }

    static func multipartBody(parts: [MultipartPart], boundary: String) -> Data {
        var body = Data()
        for part in parts {
            body.append("--\(boundary)\r\n")
            var disposition = "Content-Disposition: form-data; name=\"\(part.name)\""
            if let filename = part.filename {
                disposition += "; filename=\"\(filename)\""
            }
            body.append("\(disposition)\r\n")
            if let mimeType = part.mimeType {
                body.append("Content-Type: \(mimeType)\r\n")
            }
            body.append("\r\n")
            body.append(part.data)
            body.append("\r\n")
        }
        body.append("--\(boundary)--\r\n")
        return body
    }

    /// `Content-Disposition: attachment; filename="x.xlsx"` → `x.xlsx`
    static func filename(from response: HTTPURLResponse, fallbackPath: String) -> String {
        guard
            let disposition = response.value(forHTTPHeaderField: "Content-Disposition"),
            let range = disposition.range(of: "filename=")
        else {
            let last = fallbackPath.split(separator: "/").last.map(String.init)
            return last?.isEmpty == false ? last! : "indirilen-dosya"
        }
        let raw = disposition[range.upperBound...]
            .trimmingCharacters(in: .whitespaces)
            .trimmingCharacters(in: CharacterSet(charactersIn: "\";"))
        return raw.isEmpty ? "indirilen-dosya" : raw
    }
}

private extension Data {
    mutating func append(_ string: String) {
        append(Data(string.utf8))
    }
}

extension JSONEncoder {
    static let api: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .useDefaultKeys
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}

extension JSONDecoder {
    static let api: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .useDefaultKeys
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            if let date = ISO8601DateFormatter.full.date(from: str) { return date }
            if let date = ISO8601DateFormatter.basic.date(from: str) { return date }
            // Sunucu bazı alanlarda yalnızca gün gönderir (YYYY-MM-DD)
            if let date = DateFormatter.apiDay.date(from: str) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Geçersiz tarih: \(str)"
            )
        }
        return d
    }()
}

private extension ISO8601DateFormatter {
    static let full: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let basic: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
