import Foundation

/// TKGM parsel sorgusu. Uç `/api/ops/parsel` altında ve tek GET ile üç işi
/// yapar: ilçe listesi, mahalle listesi ve parsel sorgusu.
extension APIClient {
    func fetchParcelDistricts() async throws -> [ParcelOptionDTO] {
        let response: ParcelOptionListDTO = try await fetch(
            Endpoint("/api/ops/parsel", query: [URLQueryItem(name: "liste", value: "ilce")])
        )
        return response.items
    }

    func fetchParcelNeighborhoods(ilceId: Int) async throws -> [ParcelOptionDTO] {
        let response: ParcelOptionListDTO = try await fetch(
            Endpoint(
                "/api/ops/parsel",
                query: [URLQueryItem(name: "ilceId", value: String(ilceId))]
            )
        )
        return response.items
    }

    func fetchParcel(
        mahalleId: Int,
        ada: String,
        parsel: String,
        yenile: Bool = false
    ) async throws -> ParcelDTO {
        try await fetch(
            Endpoint(
                "/api/ops/parsel",
                query: [
                    URLQueryItem(name: "mahalleId", value: String(mahalleId)),
                    URLQueryItem(name: "ada", value: ada.isEmpty ? "0" : ada),
                    URLQueryItem(name: "parsel", value: parsel),
                ]
            ).adding([yenile ? URLQueryItem(name: "refresh", value: "1") : nil])
        )
    }

    func fetchParcel(
        lat: Double,
        lng: Double,
        yenile: Bool = false
    ) async throws -> ParcelDTO {
        try await fetch(
            Endpoint(
                "/api/ops/parsel",
                query: [
                    URLQueryItem(name: "lat", value: String(lat)),
                    URLQueryItem(name: "lng", value: String(lng)),
                ]
            ).adding([yenile ? URLQueryItem(name: "refresh", value: "1") : nil])
        )
    }
}
