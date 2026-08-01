import Foundation

/// `/kontrol-listeleri` iş akışı: taslak → kalem doldurma → onaya gönderme → karar.
extension APIClient {
    func fetchChecklistOverview() async throws -> ChecklistOverviewDTO {
        try await fetch(Endpoint("/api/v1/checklists"))
    }

    func fetchChecklist(id: String) async throws -> ChecklistDetailDTO {
        try await fetch(Endpoint("/api/v1/checklists/\(id)"))
    }

    func createChecklist(
        _ body: ChecklistCreateRequestDTO
    ) async throws -> ChecklistCreatedDTO {
        try await send(Endpoint("/api/v1/checklists", method: .post), body: body)
    }

    /// Tek kalem × periyot sonucu. ARIZALI yanıtta `bakimKaydiId` döner.
    func saveChecklistItem(
        submissionId: String,
        _ body: ChecklistItemRequestDTO
    ) async throws -> ChecklistItemSavedDTO {
        try await send(
            Endpoint("/api/v1/checklists/\(submissionId)/kalem", method: .patch),
            body: body
        )
    }

    func submitChecklist(
        id: String,
        _ body: ChecklistSubmitRequestDTO
    ) async throws -> ChecklistStateDTO {
        try await send(
            Endpoint("/api/v1/checklists/\(id)/onaya-gonder", method: .post),
            body: body
        )
    }

    func decideChecklist(
        id: String,
        _ body: ChecklistDecisionRequestDTO
    ) async throws -> ChecklistStateDTO {
        try await send(
            Endpoint("/api/v1/checklists/\(id)/onayla", method: .post),
            body: body
        )
    }
}
