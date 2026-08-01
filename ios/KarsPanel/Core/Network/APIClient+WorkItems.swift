import Foundation

/// `/islerim` uçları — saha personelinin kendisine atanan işleri.
extension APIClient {
    func fetchWorkItems() async throws -> WorkItemsDTO {
        try await fetch(Endpoint("/api/v1/islerim"))
    }

    func fetchWorkItemComplaint(id: String) async throws -> WorkItemComplaintDetailDTO {
        try await fetch(Endpoint("/api/v1/islerim/sikayet/\(id)"))
    }

    @discardableResult
    func updateWorkItemComplaintStatus(
        id: String,
        durum: ComplaintStatus,
        cozumNotu: String?
    ) async throws -> EmptyResponse {
        try await send(
            Endpoint("/api/v1/islerim/sikayet/\(id)", method: .patch),
            body: WorkItemStatusRequestDTO(durum: durum.rawValue, cozumNotu: cozumNotu)
        )
    }

    @discardableResult
    func updateWorkItemRoadStatus(
        id: String,
        durum: AsphaltStatus
    ) async throws -> EmptyResponse {
        try await send(
            Endpoint("/api/v1/islerim/asfalt/\(id)", method: .patch),
            body: WorkItemRoadStatusRequestDTO(durum: durum.rawValue)
        )
    }

    /// Vatandaşa WhatsApp cevabı; yetki atamaya bağlıdır, role değil.
    @discardableResult
    func replyOnWhatsApp(complaintId: String, text: String) async throws -> EmptyResponse {
        try await send(
            Endpoint("/api/v1/complaints/\(complaintId)/whatsapp-cevap", method: .post),
            body: WhatsAppReplyRequestDTO(text: text)
        )
    }
}
