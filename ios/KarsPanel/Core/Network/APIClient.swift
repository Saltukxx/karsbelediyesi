import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case put = "PUT"
    case delete = "DELETE"
}

@MainActor
final class APIClient: ObservableObject {
    static let shared = APIClient()

    static var onUnauthorized: (() -> Void)?
    private var token: String?
    private let session: URLSession
    private let redirectGuard = RedirectBlocker()
    private var baseURL: URL { AppConfig.baseURL }

    init(session: URLSession? = nil) {
        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            // Varsayılan 60 sn saha hattında kullanıcıyı bir dakika spinner karşısında
            // bekletiyor; takılan isteği erken bırakıp hatayı göstermek daha iyi.
            config.timeoutIntervalForRequest = 20
            config.timeoutIntervalForResource = 120
            self.session = URLSession(
                configuration: config,
                delegate: redirectGuard,
                delegateQueue: nil
            )
        }
    }

    func setToken(_ token: String?) {
        self.token = token
    }

    // MARK: - Auth

    func login(phone: String, password: String) async throws -> LoginResponseDTO {
        try await request(
            path: "/api/v1/auth/login",
            method: .post,
            body: LoginRequestDTO(phone: phone, password: password),
            authenticated: false
        )
    }

    // MARK: - Dashboard

    func fetchDashboard(
        aralik: String = "30g",
        bas: String? = nil,
        bit: String? = nil
    ) async throws -> DashboardDTO {
        var query: [URLQueryItem] = [URLQueryItem(name: "aralik", value: aralik)]
        if let bas { query.append(URLQueryItem(name: "bas", value: bas)) }
        if let bit { query.append(URLQueryItem(name: "bit", value: bit)) }
        return try await request(path: "/api/v1/dashboard", query: query)
    }

    // MARK: - Complaints

    func fetchComplaints(sekme: String? = nil, limit: Int? = nil) async throws -> [ComplaintDTO] {
        var query = Self.limitQuery(limit)
        if let sekme { query.append(URLQueryItem(name: "sekme", value: sekme)) }
        return try await request(path: "/api/v1/complaints", query: query)
    }

    func fetchComplaint(id: String) async throws -> ComplaintDTO {
        try await request(path: "/api/v1/complaints/\(id)")
    }

    func createComplaint(_ body: CreateComplaintRequestDTO) async throws -> ComplaintDTO {
        try await request(path: "/api/v1/complaints", method: .post, body: body)
    }

    func updateComplaint(id: String, body: UpdateComplaintRequestDTO) async throws -> ComplaintDTO {
        try await request(path: "/api/v1/complaints/\(id)", method: .patch, body: body)
    }

    // MARK: - Other modules

    /// Liste uçları `?limit=` ile daha fazla satır verebilir; verilmezse sunucu varsayılanı.
    static func limitQuery(_ limit: Int?) -> [URLQueryItem] {
        guard let limit, limit > 0 else { return [] }
        return [URLQueryItem(name: "limit", value: String(limit))]
    }

    func fetchWhatsAppQueue(limit: Int? = nil) async throws -> [WhatsAppMessageDTO] {
        try await request(path: "/api/v1/whatsapp", query: Self.limitQuery(limit))
    }

    func updateWhatsApp(id: String, action: String) async throws -> WhatsAppMessageDTO {
        try await request(
            path: "/api/v1/whatsapp/\(id)",
            method: .patch,
            body: ActionRequestDTO(action: action)
        )
    }

    func fetchTasks(limit: Int? = nil) async throws -> [VehicleTaskDTO] {
        try await request(path: "/api/v1/tasks", query: Self.limitQuery(limit))
    }

    func updateTask(id: String, action: String) async throws -> VehicleTaskDTO {
        try await request(
            path: "/api/v1/tasks/\(id)",
            method: .patch,
            body: ActionRequestDTO(action: action)
        )
    }

    func fetchChecklists(limit: Int? = nil) async throws -> [ChecklistSubmissionDTO] {
        try await request(path: "/api/v1/checklists", query: Self.limitQuery(limit))
    }

    func fetchVehicles(limit: Int? = nil) async throws -> [VehicleDTO] {
        try await request(path: "/api/v1/vehicles", query: Self.limitQuery(limit))
    }

    func fetchMaintenance(limit: Int? = nil) async throws -> [MaintenanceRecordDTO] {
        try await request(path: "/api/v1/maintenance", query: Self.limitQuery(limit))
    }

    func fetchFuelRecords(limit: Int? = nil) async throws -> [FuelRecordDTO] {
        try await request(path: "/api/v1/fuel", query: Self.limitQuery(limit))
    }

    func fetchFuelAnalysis() async throws -> [FuelAnalysisDTO] {
        try await request(path: "/api/v1/fuel-analysis")
    }

    func fetchMaterials(limit: Int? = nil) async throws -> [MaterialStockDTO] {
        try await request(path: "/api/v1/materials", query: Self.limitQuery(limit))
    }

    func fetchConcrete() async throws -> [ConcreteRecipeDTO] {
        try await request(path: "/api/v1/concrete")
    }

    func fetchAgrega() async throws -> [AgregaCostDTO] {
        try await request(path: "/api/v1/agrega")
    }

    func fetchBitum(limit: Int? = nil) async throws -> [BitumRecordDTO] {
        try await request(path: "/api/v1/bitum", query: Self.limitQuery(limit))
    }

    func fetchPersonnel(limit: Int? = nil) async throws -> [PersonnelDTO] {
        try await request(path: "/api/v1/personnel", query: Self.limitQuery(limit))
    }

    func fetchWorkLogs(limit: Int? = nil) async throws -> [WorkLogDTO] {
        try await request(path: "/api/v1/worklogs", query: Self.limitQuery(limit))
    }

    func fetchDefinitions() async throws -> DefinitionsDTO {
        try await request(path: "/api/v1/definitions")
    }

    func fetchReports() async throws -> [ReportSummaryDTO] {
        try await request(path: "/api/v1/reports")
    }

    func fetchLookups() async throws -> LookupsDTO {
        try await request(path: "/api/v1/lookups")
    }

    func fetchMe() async throws -> MeDTO {
        try await request(path: "/api/v1/me")
    }

    func isMissingEndpoint(_ error: Error) -> Bool {
        guard let error = error as? APIError else { return false }
        switch error {
        case .notFound, .decoding, .endpointMissing, .loginRedirect:
            return true
        case let .server(code, _) where [301, 302, 303, 307, 308, 404, 405].contains(code):
            return true
        case .invalidURL, .unauthorized, .forbidden, .server, .network, .unknown:
            return false
        }
    }

    func firstAvailable<T: Decodable>(_ attempts: [() async throws -> T]) async throws -> T {
        var last: Error = APIError.unknown
        for attempt in attempts {
            do {
                return try await attempt()
            } catch {
                if isMissingEndpoint(error) {
                    last = error
                    continue
                }
                throw error
            }
        }
        throw last
    }

    // MARK: - Location

    func sendLocation(lat: Double, lng: Double, hiz: Double?) async throws {
        let _: LocationPingResponseDTO = try await request(
            path: "/api/mobile/location",
            method: .post,
            body: LocationPingRequestDTO(lat: lat, lng: lng, hiz: hiz)
        )
    }

    // MARK: - Transport

    func makeURL(path: String, query: [URLQueryItem] = []) throws -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        components.path = path.hasPrefix("/") ? path : "/\(path)"
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.invalidURL }
        return url
    }

    func requestData(
        path: String,
        method: HTTPMethod = .get,
        query: [URLQueryItem] = []
    ) async throws -> (Data, String?) {
        let url = try makeURL(path: path, query: query)
        var req = URLRequest(url: url)
        req.httpMethod = method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.unknown }
        if http.statusCode == 401 {
            Self.onUnauthorized?()
            throw APIError.unauthorized
        }
        guard (200...299).contains(http.statusCode) else {
            throw APIError.server(http.statusCode, nil)
        }
        return (data, http.value(forHTTPHeaderField: "Content-Disposition"))
    }

    func request<T: Decodable>(
        path: String,
        method: HTTPMethod = .get,
        query: [URLQueryItem] = [],
        body: (any Encodable)? = nil,
        authenticated: Bool = true
    ) async throws -> T {
        let url = try makeURL(path: path, query: query)

        var req = URLRequest(url: url)
        req.httpMethod = method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try await encodeOffMain(body)
        }
        if authenticated, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch is CancellationError {
            throw CancellationError()
        } catch let urlError as URLError where urlError.code == .cancelled {
            throw CancellationError()
        } catch {
            throw APIError.network(error)
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.unknown }

        switch http.statusCode {
        case 200...299:
            return try await decodeOffMain(data)
        case 301, 302, 303, 307, 308:
            throw APIError.loginRedirect
        case 401:
            if authenticated { Self.onUnauthorized?() }
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw looksLikeHTML(data) ? APIError.endpointMissing : APIError.notFound
        default:
            let message = (try? JSONDecoder.api.decode(APIErrorResponse.self, from: data))?.error
            throw APIError.server(http.statusCode, message)
        }
    }

    // Sınıf @MainActor olduğu için kodlama ve çözme de arayüz iş parçacığına düşüyordu;
    // 200 kayıtlık bir liste ya da fotoğraflı gövde kaydırmayı takıyor. `nonisolated async`
    // bu iki adımı ortak yürütücüye taşır.
    nonisolated private func encodeOffMain(_ body: any Encodable) async throws -> Data {
        try JSONEncoder.api.encode(body)
    }

    nonisolated private func decodeOffMain<T: Decodable>(_ data: Data) async throws -> T {
        do {
            return try JSONDecoder.api.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

private func looksLikeHTML(_ data: Data) -> Bool {
    guard let text = String(data: data.prefix(80), encoding: .utf8) else { return false }
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return trimmed.hasPrefix("<!doctype") || trimmed.hasPrefix("<html")
}

private final class RedirectBlocker: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

private extension JSONEncoder {
    static let api: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .useDefaultKeys
        return e
    }()
}

private extension JSONDecoder {
    static let api: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .useDefaultKeys
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            if let date = ISO8601DateFormatter.full.date(from: str) { return date }
            if let date = ISO8601DateFormatter.basic.date(from: str) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date: \(str)")
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
