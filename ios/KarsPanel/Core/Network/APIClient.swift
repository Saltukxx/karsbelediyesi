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

    var baseURL = URL(string: "http://localhost:3000")!
    private var token: String?
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
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

    func fetchDashboard() async throws -> DashboardDTO {
        try await request(path: "/api/v1/dashboard")
    }

    // MARK: - Complaints

    func fetchComplaints(sekme: String? = nil) async throws -> [ComplaintDTO] {
        var query: [URLQueryItem] = []
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

    func fetchWhatsAppQueue() async throws -> [WhatsAppMessageDTO] {
        try await request(path: "/api/v1/whatsapp")
    }

    func updateWhatsApp(id: String, action: String) async throws -> WhatsAppMessageDTO {
        try await request(
            path: "/api/v1/whatsapp/\(id)",
            method: .patch,
            body: ActionRequestDTO(action: action)
        )
    }

    func fetchTasks() async throws -> [VehicleTaskDTO] {
        try await request(path: "/api/v1/tasks")
    }

    func updateTask(id: String, action: String) async throws -> VehicleTaskDTO {
        try await request(
            path: "/api/v1/tasks/\(id)",
            method: .patch,
            body: ActionRequestDTO(action: action)
        )
    }

    func fetchChecklists() async throws -> [ChecklistSubmissionDTO] {
        try await request(path: "/api/v1/checklists")
    }

    func fetchVehicles() async throws -> [VehicleDTO] {
        try await request(path: "/api/v1/vehicles")
    }

    func fetchMaintenance() async throws -> [MaintenanceRecordDTO] {
        try await request(path: "/api/v1/maintenance")
    }

    func fetchFuelRecords() async throws -> [FuelRecordDTO] {
        try await request(path: "/api/v1/fuel")
    }

    func fetchFuelAnalysis() async throws -> [FuelAnalysisDTO] {
        try await request(path: "/api/v1/fuel-analysis")
    }

    func fetchMaterials() async throws -> [MaterialStockDTO] {
        try await request(path: "/api/v1/materials")
    }

    func fetchConcrete() async throws -> [ConcreteRecipeDTO] {
        try await request(path: "/api/v1/concrete")
    }

    func fetchAgrega() async throws -> [AgregaCostDTO] {
        try await request(path: "/api/v1/agrega")
    }

    func fetchBitum() async throws -> [BitumRecordDTO] {
        try await request(path: "/api/v1/bitum")
    }

    func fetchPersonnel() async throws -> [PersonnelDTO] {
        try await request(path: "/api/v1/personnel")
    }

    func fetchWorkLogs() async throws -> [WorkLogDTO] {
        try await request(path: "/api/v1/worklogs")
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

    // MARK: - Transport

    private func makeURL(path: String, query: [URLQueryItem] = []) throws -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        components.path = path.hasPrefix("/") ? path : "/\(path)"
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.invalidURL }
        return url
    }

    private func request<T: Decodable>(
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
            req.httpBody = try JSONEncoder.api.encode(body)
        }
        if authenticated, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.network(error)
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.unknown }

        switch http.statusCode {
        case 200...299:
            do {
                return try JSONDecoder.api.decode(T.self, from: data)
            } catch {
                throw APIError.decoding(error)
            }
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        default:
            let message = (try? JSONDecoder.api.decode(APIErrorResponse.self, from: data))?.error
            throw APIError.server(http.statusCode, message)
        }
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
