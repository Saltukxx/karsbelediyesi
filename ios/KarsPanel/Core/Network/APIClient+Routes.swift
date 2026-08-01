import Foundation

/// Kış, çöp ve temizlik rota/operasyon uçları.
extension APIClient {
    // MARK: - Kış

    func fetchWinterOverview() async throws -> WinterOverviewDTO {
        try await fetch(Endpoint("/api/v1/kis/rotalar"))
    }

    func createWinterRoute(_ body: WinterRouteRequestDTO) async throws -> WinterRouteDTO {
        try await send(Endpoint("/api/v1/kis/rotalar", method: .post), body: body)
    }

    func updateWinterRoute(
        id: String,
        body: OperationRoutePatchDTO
    ) async throws -> WinterRouteDTO {
        try await send(Endpoint("/api/v1/kis/rotalar/\(id)", method: .patch), body: body)
    }

    func deleteWinterRoute(id: String) async throws -> AsphaltRoadDeletedDTO {
        try await fetch(Endpoint("/api/v1/kis/rotalar/\(id)", method: .delete))
    }

    func createWinterOperation(
        _ body: WinterOperationRequestDTO
    ) async throws -> WinterOperationDTO {
        try await send(Endpoint("/api/v1/kis/operasyonlar", method: .post), body: body)
    }

    func deleteWinterOperation(id: String) async throws -> DeletedIdDTO {
        try await fetch(Endpoint("/api/v1/kis/operasyonlar/\(id)", method: .delete))
    }

    // MARK: - Çöp

    func fetchWasteOverview() async throws -> WasteOverviewDTO {
        try await fetch(Endpoint("/api/v1/cop/rotalar"))
    }

    func createWasteRoute(_ body: WasteRouteRequestDTO) async throws -> WasteRouteDTO {
        try await send(Endpoint("/api/v1/cop/rotalar", method: .post), body: body)
    }

    func updateWasteRoute(
        id: String,
        body: OperationRoutePatchDTO
    ) async throws -> WasteRouteDTO {
        try await send(Endpoint("/api/v1/cop/rotalar/\(id)", method: .patch), body: body)
    }

    func deleteWasteRoute(id: String) async throws -> AsphaltRoadDeletedDTO {
        try await fetch(Endpoint("/api/v1/cop/rotalar/\(id)", method: .delete))
    }

    func createWasteCollection(
        _ body: WasteCollectionRequestDTO
    ) async throws -> WasteCollectionDTO {
        try await send(Endpoint("/api/v1/cop/toplama", method: .post), body: body)
    }

    func deleteWasteCollection(id: String) async throws -> DeletedIdDTO {
        try await fetch(Endpoint("/api/v1/cop/toplama/\(id)", method: .delete))
    }

    // MARK: - Temizlik

    func fetchCleaningOverview() async throws -> CleaningOverviewDTO {
        try await fetch(Endpoint("/api/v1/temizlik/rotalar"))
    }

    func createCleaningRoute(
        _ body: CleaningRouteRequestDTO
    ) async throws -> CleaningRouteDTO {
        try await send(Endpoint("/api/v1/temizlik/rotalar", method: .post), body: body)
    }

    func updateCleaningRoute(
        id: String,
        body: OperationRoutePatchDTO
    ) async throws -> CleaningRouteDTO {
        try await send(Endpoint("/api/v1/temizlik/rotalar/\(id)", method: .patch), body: body)
    }

    func deleteCleaningRoute(id: String) async throws -> AsphaltRoadDeletedDTO {
        try await fetch(Endpoint("/api/v1/temizlik/rotalar/\(id)", method: .delete))
    }
}
