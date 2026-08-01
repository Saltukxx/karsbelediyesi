import Foundation

/// Panel API uçları. Yollar `Endpoint` sabitleri üzerinden tanımlanır, böylece
/// testler web tarafındaki route listesiyle karşılaştırabilir.
extension APIClient {
    // MARK: - Auth

    func login(phone: String, password: String) async throws -> LoginResponseDTO {
        try await send(
            Endpoint("/api/v1/auth/login", method: .post, authenticated: false),
            body: LoginRequestDTO(phone: phone, password: password)
        )
    }

    // MARK: - Dashboard & lookups

    func fetchDashboard() async throws -> DashboardDTO {
        try await fetch(Endpoint("/api/v1/dashboard"))
    }

    // MARK: - Complaints

    func fetchComplaints(sekme: String? = nil) async throws -> [ComplaintDTO] {
        try await fetch(
            Endpoint("/api/v1/complaints").adding([.optional("sekme", sekme)])
        )
    }

    func fetchComplaint(id: String) async throws -> ComplaintDetailDTO {
        try await fetch(Endpoint("/api/v1/complaints/\(id)"))
    }

    func createComplaint(_ body: CreateComplaintRequestDTO) async throws -> ComplaintDTO {
        try await send(Endpoint("/api/v1/complaints", method: .post), body: body)
    }

    func updateComplaint(
        id: String,
        body: UpdateComplaintRequestDTO
    ) async throws -> ComplaintDTO {
        try await send(Endpoint("/api/v1/complaints/\(id)", method: .patch), body: body)
    }

    /// Müdürlük / personel / araç ataması — sunucuda tek uçta birleşik.
    @discardableResult
    func assignComplaint(
        id: String,
        _ assignment: ComplaintAssignment
    ) async throws -> EmptyResponse {
        try await send(
            Endpoint("/api/v1/complaints/\(id)/atama", method: .post),
            body: assignment
        )
    }

    // MARK: - WhatsApp

    func fetchWhatsAppQueue() async throws -> [WhatsAppMessageDTO] {
        try await fetch(Endpoint("/api/v1/whatsapp"))
    }

    func updateWhatsApp(id: String, action: String) async throws -> WhatsAppMessageDTO {
        try await send(
            Endpoint("/api/v1/whatsapp/\(id)", method: .patch),
            body: ActionRequestDTO(action: action)
        )
    }

    // MARK: - Tasks

    func fetchTasks() async throws -> [VehicleTaskDTO] {
        try await fetch(Endpoint("/api/v1/tasks"))
    }

    func fetchTask(id: String) async throws -> TaskDetailDTO {
        try await fetch(Endpoint("/api/v1/tasks/\(id)"))
    }

    func createTask(_ body: TaskCreateRequestDTO) async throws -> VehicleTaskDTO {
        try await send(Endpoint("/api/v1/tasks", method: .post), body: body)
    }

    func startTask(id: String, kmSayacCikis: Double?) async throws -> TaskDetailDTO {
        try await send(
            Endpoint("/api/v1/tasks/\(id)", method: .patch),
            body: TaskStartRequestDTO(kmSayacCikis: kmSayacCikis)
        )
    }

    func closeTask(
        id: String,
        girisTarihi: String?,
        kmSayacGiris: Double?,
        durum: TaskClosingStatus
    ) async throws -> TaskDetailDTO {
        try await send(
            Endpoint("/api/v1/tasks/\(id)", method: .patch),
            body: TaskCloseRequestDTO(
                girisTarihi: girisTarihi,
                kmSayacGiris: kmSayacGiris,
                durum: durum.rawValue
            )
        )
    }

    func fetchTaskTrackReport(id: String) async throws -> TaskTrackReportDTO {
        try await fetch(Endpoint("/api/v1/tasks/\(id)/takip"))
    }

    /// GPS verisi sonradan geldiğinde raporu yeniden üretir; güncel raporu döner.
    func reanalyzeTaskTrack(id: String) async throws -> TaskTrackReportDTO {
        try await fetch(Endpoint("/api/v1/tasks/\(id)/yeniden-analiz", method: .post))
    }

    // MARK: - Ortak panel uçları (cookie + Bearer)

    func search(_ query: String) async throws -> SearchResponseDTO {
        try await fetch(
            Endpoint("/api/search").adding([URLQueryItem(name: "q", value: query)])
        )
    }

    /// Excel export — ikili `.xlsx` indirir.
    func exportEntity(
        _ entity: String,
        from: Date? = nil,
        to: Date? = nil
    ) async throws -> DownloadedFile {
        try await download(
            Endpoint("/api/export/\(entity)").adding([
                .optionalDate("from", from),
                .optionalDate("to", to),
            ])
        )
    }

    // MARK: - Location

    func sendLocation(lat: Double, lng: Double, hiz: Double?) async throws {
        let _: LocationPingResponseDTO = try await send(
            Endpoint("/api/mobile/location", method: .post),
            body: LocationPingRequestDTO(lat: lat, lng: lng, hiz: hiz)
        )
    }
}
