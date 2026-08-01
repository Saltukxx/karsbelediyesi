import Foundation

/// Faz 2 insan/mesai uçları: personel ve günlük çalışma defterleri.
extension APIClient {
    // MARK: - Personel

    func fetchPersonnelPage(
        page: PageRequest = PageRequest(),
        arama: String? = nil,
        durum: String? = nil
    ) async throws -> PagedResponse<PersonnelFullDTO> {
        try await fetch(
            Endpoint("/api/v1/personnel")
                .adding(page.queryItems.map { Optional($0) })
                .adding([.optional("q", arama), .optional("durum", durum)])
        )
    }

    func fetchPersonnelCard(id: String) async throws -> PersonnelCardDTO {
        try await fetch(Endpoint("/api/v1/personnel/\(id)"))
    }

    func createPersonnel(_ body: PersonnelRequestDTO) async throws -> PersonnelFullDTO {
        try await send(Endpoint("/api/v1/personnel", method: .post), body: body)
    }

    func updatePersonnel(
        id: String,
        body: PersonnelRequestDTO
    ) async throws -> PersonnelFullDTO {
        try await send(Endpoint("/api/v1/personnel/\(id)", method: .patch), body: body)
    }

    // MARK: - Günlük çalışma

    func fetchWorkLogsOverview(
        page: PageRequest = PageRequest(),
        baslangic: Date? = nil,
        bitis: Date? = nil,
        personnelId: String? = nil,
        vehicleId: String? = nil
    ) async throws -> WorkLogsResponseDTO {
        try await fetch(
            Endpoint("/api/v1/worklogs")
                .adding(page.queryItems.map { Optional($0) })
                .adding([
                    .optionalDate("baslangic", baslangic),
                    .optionalDate("bitis", bitis),
                    .optional("personnelId", personnelId),
                    .optional("vehicleId", vehicleId),
                ])
        )
    }

    func createPersonnelWorkLog(
        _ body: PersonnelWorkLogRequestDTO
    ) async throws -> PersonnelWorkLogDTO {
        try await send(Endpoint("/api/v1/worklogs/personel", method: .post), body: body)
    }

    func createVehicleWorkLog(
        _ body: VehicleWorkLogRequestDTO
    ) async throws -> EmptyResponse {
        try await send(Endpoint("/api/v1/worklogs/arac", method: .post), body: body)
    }
}
