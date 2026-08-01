import Foundation

/// `GET /api/ops/parsel` — TKGM MEGSİS sorgusunun panel/mobil karşılığı.
struct ParcelDTO: Decodable, Identifiable, Hashable {
    let id: String
    let ilAd: String
    let ilceAd: String
    let mahalleAd: String
    let mahalleId: Int
    let adaNo: String
    let parselNo: String
    let alan: Double?
    let nitelik: String?
    let mevkii: String?
    let pafta: String?
    let geometri: ParcelGeometryDTO
    let lat: Double
    let lng: Double
    /// `cache` = yerel kopyadan, `tkgm` = canlı sorgudan
    let kaynak: String
    let sorgulandi: Date?

    var baslik: String { "\(adaNo) ada / \(parselNo) parsel" }
    var konum: String { "\(ilceAd) · \(mahalleAd)" }
    var tazeMi: Bool { kaynak == "tkgm" }
}

/// GeoJSON `Polygon` ve `MultiPolygon` tek tipte toplanır: her ikisi de
/// halka listesine indirgenir. GeoJSON sırası `[lng, lat]`.
struct ParcelGeometryDTO: Decodable, Hashable {
    let type: String
    let halkalar: [[[Double]]]

    private enum CodingKeys: String, CodingKey {
        case type, coordinates
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        if type == "MultiPolygon" {
            let poligonlar = try container.decode([[[[Double]]]].self, forKey: .coordinates)
            halkalar = poligonlar.flatMap { $0 }
        } else {
            halkalar = try container.decode([[[Double]]].self, forKey: .coordinates)
        }
    }

    /// Dış halka; harita çiziminde kullanılan ana sınır.
    var disHalka: [[Double]] { halkalar.first ?? [] }
}

/// İlçe / mahalle listesi öğesi (TKGM idari birim).
struct ParcelOptionDTO: Decodable, Identifiable, Hashable {
    let id: Int
    let ad: String
}

struct ParcelOptionListDTO: Decodable {
    let items: [ParcelOptionDTO]
}
