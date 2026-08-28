import Foundation

struct NotificationItemDTO: Codable, Identifiable, Hashable {
    let id: String
    let tip: String?
    let baslik: String?
    let mesaj: String?
    let href: String?
    let okundu: Bool?
    let createdAt: Date?
}

struct NotificationsDTO: Decodable {
    let unread: Int?
    let items: [NotificationItemDTO]?
}

struct SearchResultDTO: Codable, Identifiable, Hashable {
    let id: String
    let type: String?
    let title: String?
    let subtitle: String?
    let href: String?
}

struct SearchResponseDTO: Decodable {
    let results: [SearchResultDTO]?
}

struct IslerimDTO: Decodable {
    let sikayetler: [ComplaintDTO]?
    let asfalt: [AsfaltJobDTO]?
}

struct AsfaltJobDTO: Codable, Identifiable, Hashable {
    let id: String
    let ad: String?
    let durum: String?
    let koordinatlar: [[Double]]?
}

struct MapPayloadDTO: Decodable {
    let canEdit: Bool?
    let roads: [MapRoadDTO]?
    let hazards: [MapHazardDTO]?
    let complaints: [MapPinDTO]?
    let vehicles: [MapVehicleDTO]?

    enum CodingKeys: String, CodingKey {
        case canEdit, roads, asfalt, hazards, engeller, complaints, sikayetler, vehicles, araclar
    }

    init(
        canEdit: Bool? = nil,
        roads: [MapRoadDTO]? = nil,
        hazards: [MapHazardDTO]? = nil,
        complaints: [MapPinDTO]? = nil,
        vehicles: [MapVehicleDTO]? = nil
    ) {
        self.canEdit = canEdit
        self.roads = roads
        self.hazards = hazards
        self.complaints = complaints
        self.vehicles = vehicles
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        canEdit = try c.decodeIfPresent(Bool.self, forKey: .canEdit)
        roads =
            try c.decodeIfPresent([MapRoadDTO].self, forKey: .roads)
            ?? c.decodeIfPresent([MapRoadDTO].self, forKey: .asfalt)
        hazards =
            try c.decodeIfPresent([MapHazardDTO].self, forKey: .hazards)
            ?? c.decodeIfPresent([MapHazardDTO].self, forKey: .engeller)
        complaints =
            try c.decodeIfPresent([MapPinDTO].self, forKey: .complaints)
            ?? c.decodeIfPresent([MapPinDTO].self, forKey: .sikayetler)
        if let rows = try c.decodeIfPresent([MapVehicleDTO].self, forKey: .vehicles) {
            vehicles = rows
        } else if let rows = try c.decodeIfPresent([KomutaVehicleDTO].self, forKey: .araclar) {
            vehicles = rows.map {
                MapVehicleDTO(
                    id: $0.id,
                    plaka: $0.plaka,
                    lat: $0.lat,
                    lng: $0.lng,
                    zaman: $0.konumZamani,
                    cins: $0.tip
                )
            }
        } else {
            vehicles = nil
        }
    }
}

struct MapRoadDTO: Codable, Identifiable, Hashable {
    let id: String
    let ad: String?
    let durum: String?
    let koordinatlar: [[Double]]?
}

struct MapHazardDTO: Codable, Identifiable, Hashable {
    let id: String
    let tip: String?
    let durum: String?
    let lat: Double?
    let lng: Double?
    let aciklama: String?
    let photoIds: [String]?
}

struct MapPinDTO: Codable, Identifiable, Hashable {
    let id: String
    let sikayetNo: String?
    let durum: String?
    let lat: Double?
    let lng: Double?
    let aciklama: String?
}

struct MapVehicleDTO: Codable, Identifiable, Hashable {
    let id: String
    let plaka: String?
    let lat: Double?
    let lng: Double?
    let zaman: String?
    let cins: String?
}

struct FieldRouteDTO: Codable, Identifiable, Hashable {
    let id: String
    let ad: String?
    let koordinatlar: [[Double]]?
    let oncelik: Int?
    let notlar: String?
    let tip: String?
    let gunler: [Int]?
}

struct DispatchCandidateDTO: Codable, Identifiable, Hashable {
    var id: String { vehicleId }
    let vehicleId: String
    let plaka: String?
    let sureDk: Double?
    let mesafeKm: Double?
    let skor: Double?
}

struct DispatchCandidatesDTO: Decodable {
    let routeAd: String?
    let adaylar: [DispatchCandidateDTO]?
}

struct AuditRowDTO: Codable, Identifiable, Hashable {
    let id: String
    let userAd: String?
    let rol: String?
    let islem: String?
    let varlik: String?
    let createdAt: Date?
}

struct KomutaVehicleDTO: Decodable, Identifiable, Hashable {
    let id: String
    let plaka: String?
    let tip: String?
    let lat: Double?
    let lng: Double?
    let konumZamani: String?
}

struct KomutaDTO: Decodable {
    let araclar: [KomutaVehicleDTO]?
    let sikayetPinleri: [MapPinDTO]?

    enum CodingKeys: String, CodingKey {
        case araclar, vehicles, sikayetPinleri, sikayetler, complaints
    }

    init(araclar: [KomutaVehicleDTO]?, sikayetPinleri: [MapPinDTO]?) {
        self.araclar = araclar
        self.sikayetPinleri = sikayetPinleri
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let rows = try c.decodeIfPresent([KomutaVehicleDTO].self, forKey: .araclar) {
            araclar = rows
        } else if let rows = try c.decodeIfPresent([MapVehicleDTO].self, forKey: .vehicles) {
            araclar = rows.map {
                KomutaVehicleDTO(
                    id: $0.id,
                    plaka: $0.plaka,
                    tip: $0.cins,
                    lat: $0.lat,
                    lng: $0.lng,
                    konumZamani: $0.zaman
                )
            }
        } else {
            araclar = nil
        }
        sikayetPinleri =
            try c.decodeIfPresent([MapPinDTO].self, forKey: .sikayetPinleri)
            ?? c.decodeIfPresent([MapPinDTO].self, forKey: .sikayetler)
            ?? c.decodeIfPresent([MapPinDTO].self, forKey: .complaints)
    }

    var vehicles: [MapVehicleDTO] {
        (araclar ?? []).map {
            MapVehicleDTO(
                id: $0.id,
                plaka: $0.plaka,
                lat: $0.lat,
                lng: $0.lng,
                zaman: $0.konumZamani,
                cins: $0.tip
            )
        }
    }
}

struct ParselDTO: Decodable {
    let ilAd: String?
    let ilceAd: String?
    let mahalleAd: String?
    let adaNo: String?
    let parselNo: String?
    let alan: Double?
    let nitelik: String?
    let lat: Double?
    let lng: Double?
    let geometri: ParselGeometryDTO?
}

struct ParselGeometryDTO: Decodable {
    let type: String?
    let coordinates: [[[Double]]]?
}

struct ChecklistDetailDTO: Decodable {
    let id: String
    let durum: String?
    let sablonAdi: String?
    let items: [ChecklistItemDTO]?
}

struct ChecklistItemDTO: Codable, Identifiable, Hashable {
    let id: String
    let kontrolKalemi: String?
}

struct NamedItemDTO: Codable, Identifiable, Hashable {
    let id: String
    let name: String?
}

extension UpdateComplaintRequestDTO {
    var cozumFotolari: [String]? { nil }
}

struct UpdateComplaintFullDTO: Encodable {
    var durum: ComplaintStatus?
    var cozumNotu: String?
    var lat: Double?
    var lng: Double?
    var departmentId: String?
    var vehicleId: String?
    var personnelIds: [String]?
    var cozumFotolari: [String]?
}
