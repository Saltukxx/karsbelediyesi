import Foundation

/// Faz 2 üretim/depo uçları: malzeme, beton, agrega, bitüm.
extension APIClient {
    // MARK: - Malzeme / depo

    func fetchMaterialPage(
        page: PageRequest = PageRequest(),
        arama: String? = nil,
        kategori: String? = nil,
        sadeceKritik: Bool = false
    ) async throws -> MaterialListDTO {
        try await fetch(
            Endpoint("/api/v1/materials")
                .adding(page.queryItems.map { Optional($0) })
                .adding([
                    .optional("q", arama),
                    .optional("kategori", kategori),
                    sadeceKritik ? URLQueryItem(name: "kritik", value: "1") : nil,
                ])
        )
    }

    func createMaterial(_ body: MaterialRequestDTO) async throws -> MaterialDTO {
        try await send(Endpoint("/api/v1/materials", method: .post), body: body)
    }

    func fetchMaterialMovements(
        page: PageRequest = PageRequest(),
        materialId: String? = nil,
        tip: String? = nil
    ) async throws -> PagedResponse<MaterialMovementDTO> {
        try await fetch(
            Endpoint("/api/v1/materials/hareket")
                .adding(page.queryItems.map { Optional($0) })
                .adding([.optional("materialId", materialId), .optional("tip", tip)])
        )
    }

    func createMaterialMovement(
        _ body: MaterialMovementRequestDTO
    ) async throws -> EmptyResponse {
        try await send(Endpoint("/api/v1/materials/hareket", method: .post), body: body)
    }

    // MARK: - Beton

    func fetchConcreteOverview() async throws -> ConcreteResponseDTO {
        try await fetch(Endpoint("/api/v1/concrete"))
    }

    func createConcreteProduction(
        _ body: ConcreteProductionRequestDTO
    ) async throws -> ConcreteProductionDTO {
        try await send(Endpoint("/api/v1/concrete/uretim", method: .post), body: body)
    }

    func addConcreteStock(
        _ body: ConcreteStockRequestDTO
    ) async throws -> ConcreteStockDTO {
        try await send(Endpoint("/api/v1/concrete/stok", method: .post), body: body)
    }

    func updateConcreteRecipe(
        id: String,
        body: ConcreteRecipeRequestDTO
    ) async throws -> EmptyResponse {
        try await send(
            Endpoint("/api/v1/concrete/recete/\(id)", method: .patch),
            body: body
        )
    }

    // MARK: - Agrega

    func fetchAgregaOverview() async throws -> AgregaResponseDTO {
        try await fetch(Endpoint("/api/v1/agrega"))
    }

    func saveAgregaParams(
        _ body: AgregaParamsRequestDTO
    ) async throws -> AgregaResponseDTO {
        try await send(Endpoint("/api/v1/agrega/parametre", method: .post), body: body)
    }

    // MARK: - Bitüm

    func fetchBitumOverview(
        page: PageRequest = PageRequest(),
        tip: String? = nil
    ) async throws -> BitumResponseDTO {
        try await fetch(
            Endpoint("/api/v1/bitum")
                .adding(page.queryItems.map { Optional($0) })
                .adding([.optional("tip", tip)])
        )
    }

    func saveBitumSettings(
        _ body: BitumSettingsRequestDTO
    ) async throws -> BitumSettingsDTO {
        try await send(Endpoint("/api/v1/bitum/ayar", method: .post), body: body)
    }

    func createBitumMovement(
        _ body: BitumMovementRequestDTO
    ) async throws -> BitumMovementDTO {
        try await send(Endpoint("/api/v1/bitum/hareket", method: .post), body: body)
    }
}
