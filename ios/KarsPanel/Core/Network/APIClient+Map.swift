import Foundation

/// Harita platformu uçları: katmanlar, asfalt yol CRUD ve engel kaydı.
extension APIClient {
    func fetchMapLayers() async throws -> MapLayersDTO {
        try await fetch(Endpoint("/api/v1/harita/katmanlar"))
    }

    func createAsphaltRoad(_ body: AsphaltRoadRequestDTO) async throws -> AsphaltRoadDTO {
        try await send(Endpoint("/api/v1/harita/yollar", method: .post), body: body)
    }

    func updateAsphaltRoad(
        id: String,
        body: AsphaltRoadPatchDTO
    ) async throws -> AsphaltRoadDTO {
        try await send(Endpoint("/api/v1/harita/yollar/\(id)", method: .patch), body: body)
    }

    func deleteAsphaltRoad(id: String) async throws -> AsphaltRoadDeletedDTO {
        try await fetch(Endpoint("/api/v1/harita/yollar/\(id)", method: .delete))
    }

    func assignAsphaltPersonnel(
        id: String,
        personnelIds: [String]
    ) async throws -> AsphaltPersonnelResponseDTO {
        try await send(
            Endpoint("/api/v1/harita/yollar/\(id)/personel", method: .post),
            body: AsphaltPersonnelRequestDTO(personnelIds: personnelIds)
        )
    }

    /// Fotoğraflı engel kaydı. Sunucu JPEG/PNG/WebP ve en fazla 8 MB kabul eder;
    /// fotoğraf yoksa da aynı uç multipart olarak çağrılır.
    func createHazard(
        lat: Double,
        lng: Double,
        tip: HazardKind,
        aciklama: String?,
        photos: [HazardPhotoUpload]
    ) async throws -> HazardCreatedDTO {
        var parts: [MultipartPart] = [
            .field("lat", String(lat)),
            .field("lng", String(lng)),
            .field("tip", tip.rawValue),
        ]
        if let aciklama, !aciklama.isEmpty {
            parts.append(.field("aciklama", aciklama))
        }
        for photo in photos {
            parts.append(
                .file(
                    "photos",
                    filename: photo.filename,
                    mimeType: photo.mimeType,
                    data: photo.data
                )
            )
        }
        return try await upload(Endpoint("/api/v1/harita/engeller", method: .post), parts: parts)
    }

    func updateHazardStatus(
        id: String,
        durum: HazardStatus
    ) async throws -> HazardStatusResponseDTO {
        try await send(
            Endpoint("/api/v1/harita/engeller/\(id)", method: .patch),
            body: HazardStatusRequestDTO(durum: durum.rawValue)
        )
    }

    func deleteHazard(id: String) async throws -> DeletedIdDTO {
        try await fetch(Endpoint("/api/v1/harita/engeller/\(id)", method: .delete))
    }

    /// Engel fotoğrafı yalnız oturumlu indirilebilir; `AsyncImage` yerine
    /// bu uçtan çekilip bellekte gösterilir.
    func downloadHazardPhoto(id: String) async throws -> DownloadedFile {
        try await download(Endpoint("/api/ops/hazard-photo/\(id)"))
    }
}

/// Kameradan veya galeriden seçilen tek fotoğrafın yükleme paketi.
struct HazardPhotoUpload: Identifiable, Hashable {
    let id = UUID()
    let data: Data
    let filename: String
    let mimeType: String

    static func jpeg(_ data: Data, index: Int) -> HazardPhotoUpload {
        HazardPhotoUpload(
            data: data,
            filename: "engel-\(index + 1).jpg",
            mimeType: "image/jpeg"
        )
    }
}
