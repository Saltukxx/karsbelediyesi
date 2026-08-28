import Foundation

extension APIClient {
    func postOk(path: String, body: some Encodable) async throws {
        let _: OkDTO = try await request(path: path, method: .post, body: body)
    }

    func patchOk(path: String, body: some Encodable) async throws {
        let _: OkDTO = try await request(path: path, method: .patch, body: body)
    }

    func fetchIslerim() async throws -> IslerimDTO {
        try await firstAvailable([
            { try await self.request(path: "/api/v1/islerim") },
            {
                let rows: [ComplaintDTO] = try await self.request(path: "/api/mobile/complaints")
                return IslerimDTO(sikayetler: rows, asfalt: [])
            },
        ])
    }

    func updateIslerimComplaint(id: String, durum: String, cozumNotu: String?, photos: [String]?) async throws {
        struct Body: Encodable {
            let durum: String
            let cozumNotu: String?
            let cozumFotolari: [String]?
        }
        let payload = Body(durum: durum, cozumNotu: cozumNotu, cozumFotolari: photos)
        do {
            try await patchOk(path: "/api/v1/islerim/complaints/\(id)", body: payload)
        } catch {
            guard isMissingEndpoint(error) else { throw error }
            let _: ComplaintDTO = try await request(
                path: "/api/mobile/complaints/\(id)",
                method: .patch,
                body: payload
            )
        }
    }

    func updateIslerimAsfalt(id: String, durum: String) async throws {
        try await patchOk(path: "/api/v1/islerim/asphalt/\(id)", body: ["durum": durum])
    }

    func replyWhatsApp(complaintId: String, text: String) async throws {
        try await postOk(path: "/api/v1/whatsapp/reply", body: ["complaintId": complaintId, "text": text])
    }

    func fetchNotifications() async throws -> NotificationsDTO {
        try await firstAvailable([
            { try await self.request(path: "/api/v1/notifications") },
            { try await self.request(path: "/api/ops/notifications") },
        ])
    }

    func markNotificationsRead(id: String? = nil, all: Bool = false) async throws {
        struct Body: Encodable {
            let id: String?
            let all: Bool?
        }
        let body = Body(id: id, all: all ? true : nil)
        do {
            try await patchOk(path: "/api/v1/notifications", body: body)
        } catch {
            guard isMissingEndpoint(error) else { throw error }
            try await patchOk(path: "/api/ops/notifications", body: body)
        }
    }

    func fetchMap() async throws -> MapPayloadDTO {
        try await firstAvailable([
            { try await self.request(path: "/api/v1/map") },
            {
                let komuta: KomutaDTO = try await self.request(path: "/api/ops/komuta")
                return MapPayloadDTO(
                    canEdit: false,
                    complaints: komuta.sikayetPinleri,
                    vehicles: komuta.vehicles
                )
            },
            {
                let pins = try await self.fetchComplaints().compactMap(\.mapPin)
                return MapPayloadDTO(canEdit: false, complaints: pins)
            },
        ])
    }

    func saveMapRoad(ad: String, coords: [[Double]]) async throws {
        struct Body: Encodable {
            let kind: String
            let ad: String
            let koordinatlar: [[Double]]
        }
        try await postOk(path: "/api/v1/map", body: Body(kind: "road", ad: ad, koordinatlar: coords))
    }

    func saveHazard(lat: Double, lng: Double, aciklama: String, tip: String) async throws {
        struct Body: Encodable {
            let kind: String
            let lat: Double
            let lng: Double
            let aciklama: String
            let tip: String
        }
        try await postOk(
            path: "/api/v1/map",
            body: Body(kind: "hazard", lat: lat, lng: lng, aciklama: aciklama, tip: tip)
        )
    }

    func fetchFieldRoutes(kind: String) async throws -> [FieldRouteDTO] {
        try await request(path: "/api/v1/\(kind)")
    }

    func saveFieldRoute(kind: String, ad: String, coords: [[Double]], gunler: [Int]? = nil) async throws {
        struct Body: Encodable {
            let ad: String
            let koordinatlar: [[Double]]
            let gunler: [Int]?
        }
        try await postOk(path: "/api/v1/\(kind)", body: Body(ad: ad, koordinatlar: coords, gunler: gunler))
    }

    func saveFieldOperation(kind: String, routeId: String) async throws {
        try await postOk(path: "/api/v1/\(kind)", body: ["action": "operation", "routeId": routeId])
    }

    func fetchDispatchCandidates(kind: String, routeId: String) async throws -> DispatchCandidatesDTO {
        try await request(
            path: "/api/v1/\(kind)",
            method: .post,
            body: ["action": "candidates", "routeId": routeId]
        )
    }

    func assignDispatch(kind: String, routeId: String, vehicleId: String) async throws {
        try await postOk(
            path: "/api/v1/\(kind)",
            body: ["action": "dispatch", "routeId": routeId, "vehicleId": vehicleId]
        )
    }

    func fetchKomuta() async throws -> KomutaDTO {
        try await firstAvailable([
            { try await self.request(path: "/api/ops/komuta") },
            { try await self.request(path: "/api/v1/map") },
            {
                let pins = try await self.fetchComplaints().compactMap(\.mapPin)
                return KomutaDTO(araclar: nil, sikayetPinleri: pins)
            },
        ])
    }

    func fetchParsel(lat: Double, lng: Double) async throws -> ParselDTO {
        let query = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lng", value: String(lng)),
        ]
        return try await firstAvailable([
            { try await self.request(path: "/api/v1/parsel", query: query) },
            { try await self.request(path: "/api/ops/parsel", query: query) },
        ])
    }

    func search(q: String) async throws -> SearchResponseDTO {
        try await request(path: "/api/search", query: [URLQueryItem(name: "q", value: q)])
    }

    func fetchAudit(limit: Int? = nil) async throws -> [AuditRowDTO] {
        try await request(path: "/api/v1/audit", query: Self.limitQuery(limit))
    }

    func fetchChecklistTemplates() async throws -> [NamedItemDTO] {
        try await firstAvailable([
            { try await self.request(path: "/api/v1/checklists/templates") },
            {
                struct MobileTemplate: Decodable, Identifiable {
                    let id: String
                    let ekipmanAdi: String?
                    let name: String?
                }
                let rows: [MobileTemplate] = try await self.request(path: "/api/mobile/checklists/templates")
                return rows.map { NamedItemDTO(id: $0.id, name: $0.name ?? $0.ekipmanAdi) }
            },
        ])
    }

    func fetchChecklistDetail(id: String) async throws -> ChecklistDetailDTO {
        try await request(path: "/api/v1/checklists/\(id)")
    }

    func createChecklist(templateId: String, vehicleId: String) async throws {
        let now = Calendar.current.dateComponents([.year, .month], from: Date())
        struct Body: Encodable {
            let templateId: String
            let vehicleId: String
            let ay: Int
            let yilDonem: Int
        }
        let payload = Body(
            templateId: templateId,
            vehicleId: vehicleId,
            ay: now.month ?? 1,
            yilDonem: now.year ?? 2026
        )
        do {
            try await postOk(path: "/api/v1/checklists", body: payload)
        } catch {
            guard isMissingEndpoint(error) else { throw error }
            struct SyncBody: Encodable {
                let templateId: String
                let vehicleId: String
                let ay: Int
                let yilDonem: Int
                let results: [String]
            }
            try await postOk(
                path: "/api/mobile/checklists/sync",
                body: SyncBody(
                    templateId: payload.templateId,
                    vehicleId: payload.vehicleId,
                    ay: payload.ay,
                    yilDonem: payload.yilDonem,
                    results: []
                )
            )
        }
    }

    func patchChecklist(id: String, action: String, extra: [String: String] = [:]) async throws {
        var body = extra
        body["action"] = action
        try await patchOk(path: "/api/v1/checklists/\(id)", body: body)
    }

    func createWorkLog(kind: String, fields: [String: String]) async throws {
        var body = fields
        body["kind"] = kind
        do {
            try await postOk(path: "/api/v1/worklogs", body: body)
        } catch {
            guard isMissingEndpoint(error), kind != "arac" else { throw error }
            struct MobileWorkLog: Encodable {
                let girisSaati: String
                let cikisSaati: String
                let yapilanIs: String?
            }
            try await postOk(
                path: "/api/mobile/worklog",
                body: MobileWorkLog(
                    girisSaati: fields["girisSaati"] ?? "",
                    cikisSaati: fields["cikisSaati"] ?? "",
                    yapilanIs: fields["yapilanIs"]
                )
            )
        }
    }

    func createVehicle(plaka: String, marka: String?) async throws -> VehicleDTO {
        struct Body: Encodable {
            let plaka: String
            let marka: String?
        }
        return try await request(path: "/api/v1/vehicles", method: .post, body: Body(plaka: plaka, marka: marka))
    }

    func scrapVehicle(id: String) async throws {
        try await patchOk(path: "/api/v1/vehicles/\(id)", body: ["action": "hurdaya"])
    }

    func createMaintenance(vehicleId: String, notes: String) async throws {
        try await postOk(path: "/api/v1/maintenance", body: ["vehicleId": vehicleId, "yapilanIslemler": notes])
    }

    func createFuel(vehicleId: String, litre: Double, birimFiyat: Double) async throws {
        struct Body: Encodable {
            let vehicleId: String
            let litre: Double
            let birimFiyat: Double
        }
        try await postOk(path: "/api/v1/fuel", body: Body(vehicleId: vehicleId, litre: litre, birimFiyat: birimFiyat))
    }

    func createMaterial(kod: String, ad: String, birim: String) async throws {
        try await postOk(path: "/api/v1/materials", body: ["kod": kod, "ad": ad, "birim": birim, "kategori": "GENEL"])
    }

    func createPersonnel(adSoyad: String, unvan: String?) async throws {
        struct Body: Encodable {
            let adSoyad: String
            let unvan: String?
        }
        try await postOk(path: "/api/v1/personnel", body: Body(adSoyad: adSoyad, unvan: unvan))
    }

    func deactivatePersonnel(id: String) async throws {
        try await patchOk(path: "/api/v1/personnel", body: ["action": "deactivate", "id": id])
    }

    func createDefinition(kind: String, name: String) async throws {
        try await postOk(path: "/api/v1/definitions", body: ["kind": kind, "name": name])
    }

    func createTask(vehicleId: String, aciklama: String) async throws -> VehicleTaskDTO {
        struct Body: Encodable {
            let vehicleId: String
            let gorevTanimi: String
        }
        return try await request(
            path: "/api/v1/tasks",
            method: .post,
            body: Body(vehicleId: vehicleId, gorevTanimi: aciklama)
        )
    }

    func updateTaskKm(id: String, action: String, km: Double?) async throws -> VehicleTaskDTO {
        struct Body: Encodable {
            let action: String
            let kmSayacCikis: Double?
            let kmSayacGiris: Double?
        }
        return try await request(
            path: "/api/v1/tasks/\(id)",
            method: .patch,
            body: Body(
                action: action,
                kmSayacCikis: action == "start" ? km : nil,
                kmSayacGiris: action == "close" ? km : nil
            )
        )
    }

    func reanalyzeTask(id: String) async throws {
        try await postOk(path: "/api/v1/tasks/\(id)", body: ["action": "reanalyze"])
    }

    func exportEntity(_ entity: String) async throws -> Data {
        let (data, _) = try await requestData(path: "/api/export/\(entity)")
        return data
    }

    func updateComplaintFull(id: String, body: UpdateComplaintFullDTO) async throws -> ComplaintDTO {
        try await request(path: "/api/v1/complaints/\(id)", method: .patch, body: body)
    }

    func createConcrete(recipeId: String, hedefM3: Double) async throws {
        struct Body: Encodable {
            let recipeId: String
            let hedefM3: Double
        }
        try await postOk(path: "/api/v1/concrete", body: Body(recipeId: recipeId, hedefM3: hedefM3))
    }

    func createBitum(depoId: String, miktarTon: Double) async throws {
        struct Body: Encodable {
            let depoId: String
            let miktarTon: Double
        }
        try await postOk(path: "/api/v1/bitum", body: Body(depoId: depoId, miktarTon: miktarTon))
    }
}
