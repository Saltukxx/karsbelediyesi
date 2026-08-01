import Foundation

/// Faz 2 filo uçları: araç envanteri, bakım ve yakıt.
extension APIClient {
    // MARK: - Araç

    func fetchVehiclePage(
        page: PageRequest = PageRequest(),
        arama: String? = nil,
        envanterDurumu: String? = nil
    ) async throws -> PagedResponse<VehicleListItemDTO> {
        try await fetch(
            Endpoint("/api/v1/vehicles")
                .adding(page.queryItems.map { Optional($0) })
                .adding([
                    .optional("q", arama),
                    .optional("envanterDurumu", envanterDurumu),
                ])
        )
    }

    func fetchVehicleCard(id: String) async throws -> VehicleCardDTO {
        try await fetch(Endpoint("/api/v1/vehicles/\(id)"))
    }

    func createVehicle(_ body: VehicleRequestDTO) async throws -> VehicleDetailDTO {
        try await send(Endpoint("/api/v1/vehicles", method: .post), body: body)
    }

    func updateVehicle(
        id: String,
        body: VehicleRequestDTO
    ) async throws -> VehicleDetailDTO {
        try await send(Endpoint("/api/v1/vehicles/\(id)", method: .patch), body: body)
    }

    // MARK: - Bakım

    func fetchMaintenancePage(
        page: PageRequest = PageRequest(),
        vehicleId: String? = nil,
        durum: String? = nil
    ) async throws -> PagedResponse<MaintenanceDTO> {
        try await fetch(
            Endpoint("/api/v1/maintenance")
                .adding(page.queryItems.map { Optional($0) })
                .adding([.optional("vehicleId", vehicleId), .optional("durum", durum)])
        )
    }

    func createMaintenance(_ body: MaintenanceRequestDTO) async throws -> MaintenanceSummaryDTO {
        try await send(Endpoint("/api/v1/maintenance", method: .post), body: body)
    }

    // MARK: - Yakıt

    func fetchFuelPage(
        page: PageRequest = PageRequest(),
        vehicleId: String? = nil,
        baslangic: Date? = nil,
        bitis: Date? = nil
    ) async throws -> FuelListDTO {
        try await fetch(
            Endpoint("/api/v1/fuel")
                .adding(page.queryItems.map { Optional($0) })
                .adding([
                    .optional("vehicleId", vehicleId),
                    .optionalDate("baslangic", baslangic),
                    .optionalDate("bitis", bitis),
                ])
        )
    }

    func createFuelRecord(_ body: FuelRequestDTO) async throws -> FuelSummaryDTO {
        try await send(Endpoint("/api/v1/fuel", method: .post), body: body)
    }

    // MARK: - Akaryakıt analizi

    func fetchAkaryakitAnalysis(
        mudurluk: String? = nil,
        ay: String? = nil
    ) async throws -> AkaryakitResponseDTO {
        try await fetch(
            Endpoint("/api/v1/akaryakit")
                .adding([.optional("mudurluk", mudurluk), .optional("ay", ay)])
        )
    }
}
