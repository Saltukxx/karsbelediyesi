import Foundation

/// Komuta ekranı, akıllı sevkiyat, bildirim kutusu ve APNs cihaz kaydı uçları.
extension APIClient {
    // MARK: - Komuta

    func fetchKomuta() async throws -> KomutaVeriDTO {
        try await fetch(Endpoint("/api/v1/komuta"))
    }

    /// SLA taraması bildirim uçlarında kendiliğinden çalışır; bu uç komuta
    /// ekranındaki elle tetikleme içindir (`zorla` 10 dk kısıtını atlar).
    func runSlaScan(zorla: Bool = true) async throws -> SlaScanResultDTO {
        try await fetch(
            Endpoint("/api/v1/sla/tarama", method: .post)
                .adding([.optional("zorla", zorla)])
        )
    }

    // MARK: - Sevkiyat

    func fetchDispatchCandidates(
        tip: DispatchTip,
        routeId: String
    ) async throws -> DispatchAdaylarDTO {
        try await fetch(
            Endpoint("/api/v1/dispatch/adaylar").adding([
                URLQueryItem(name: "tip", value: tip.rawValue),
                URLQueryItem(name: "routeId", value: routeId),
            ])
        )
    }

    /// Rota için en uygun aracı bulup bekleyen öneri üretir; uygun araç yoksa nil.
    func suggestDispatch(
        tip: DispatchTip,
        routeId: String
    ) async throws -> DispatchOneriDTO? {
        try await send(
            Endpoint("/api/v1/dispatch/oner", method: .post),
            body: DispatchRotaRequestDTO(tip: tip.rawValue, routeId: routeId)
        )
    }

    /// Seçilen aracı rotaya atar ve görevi tek adımda açar.
    func assignVehicleToRoute(
        tip: DispatchTip,
        routeId: String,
        vehicleId: String
    ) async throws -> DispatchAtamaDTO {
        try await send(
            Endpoint("/api/v1/dispatch/arac-ata", method: .post),
            body: DispatchAracRequestDTO(
                tip: tip.rawValue,
                routeId: routeId,
                vehicleId: vehicleId
            )
        )
    }

    func acceptDispatch(jobId: String) async throws -> DispatchAtamaDTO {
        try await send(
            Endpoint("/api/v1/dispatch/ata", method: .post),
            body: DispatchOneriRequestDTO(jobId: jobId)
        )
    }

    @discardableResult
    func rejectDispatch(jobId: String) async throws -> DispatchReddetDTO {
        try await send(
            Endpoint("/api/v1/dispatch/reddet", method: .post),
            body: DispatchOneriRequestDTO(jobId: jobId)
        )
    }

    // MARK: - Bildirimler

    func fetchNotifications(limit: Int? = nil) async throws -> NotificationListDTO {
        try await fetch(
            Endpoint("/api/v1/notifications").adding([.optional("limit", limit)])
        )
    }

    @discardableResult
    func markNotificationRead(id: String) async throws -> NotificationReadDTO {
        try await fetch(Endpoint("/api/v1/notifications/\(id)", method: .patch))
    }

    @discardableResult
    func markAllNotificationsRead() async throws -> NotificationReadDTO {
        try await fetch(Endpoint("/api/v1/notifications/tumunu-oku", method: .post))
    }

    // MARK: - APNs cihaz kaydı

    @discardableResult
    func registerDevice(
        _ body: DeviceRegisterRequestDTO
    ) async throws -> DeviceRegistrationDTO {
        try await send(Endpoint("/api/v1/devices", method: .post), body: body)
    }

    /// Çıkışta cihazı pasifleştirir; sunucu kaydı silmez.
    func unregisterDevice(token: String) async throws {
        let _: EmptyResponse = try await send(
            Endpoint("/api/v1/devices", method: .delete),
            body: DeviceUnregisterRequestDTO(token: token)
        )
    }
}
