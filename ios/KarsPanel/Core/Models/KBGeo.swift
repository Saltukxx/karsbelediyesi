import Foundation

/// Sunucu tüm rota geometrilerini `[[lat, lng]]` olarak gönderir. MapKit'ten
/// bağımsız bir koordinat tipi tutulur; böylece uzunluk/merkez hesapları
/// UI olmadan test edilebilir.
struct KBCoordinate: Hashable, Codable {
    let lat: Double
    let lng: Double

    init(lat: Double, lng: Double) {
        self.lat = lat
        self.lng = lng
    }

    init?(pair: [Double]) {
        guard pair.count >= 2, pair[0].isFinite, pair[1].isFinite else { return nil }
        self.init(lat: pair[0], lng: pair[1])
    }

    var pair: [Double] { [lat, lng] }
}

enum KBGeo {
    static let dunyaYaricapiM = 6_371_000.0

    static func coordinates(_ raw: [[Double]]) -> [KBCoordinate] {
        raw.compactMap(KBCoordinate.init(pair:))
    }

    static func pairs(_ coordinates: [KBCoordinate]) -> [[Double]] {
        coordinates.map(\.pair)
    }

    /// GeoJSON `[lng, lat]` sırasını sunucunun `[lat, lng]` sırasına çevirir.
    static func fromGeoJSON(_ raw: [[Double]]) -> [KBCoordinate] {
        raw.compactMap { pair in
            guard pair.count >= 2 else { return nil }
            return KBCoordinate(lat: pair[1], lng: pair[0])
        }
    }

    /// Haversine — web'deki `geo-track.ts` mesafe hesabıyla aynı yöntem.
    static func mesafeMetre(_ a: KBCoordinate, _ b: KBCoordinate) -> Double {
        let lat1 = a.lat * .pi / 180
        let lat2 = b.lat * .pi / 180
        let dLat = (b.lat - a.lat) * .pi / 180
        let dLng = (b.lng - a.lng) * .pi / 180
        let h =
            sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * dunyaYaricapiM * asin(min(1, sqrt(h)))
    }

    static func uzunlukMetre(_ coordinates: [KBCoordinate]) -> Double {
        guard coordinates.count >= 2 else { return 0 }
        return zip(coordinates, coordinates.dropFirst())
            .reduce(0) { $0 + mesafeMetre($1.0, $1.1) }
    }

    /// 1 km altındaki uzunluklar metre, üstü kilometre olarak okunur.
    static func uzunlukMetni(_ metre: Double) -> String {
        guard metre.isFinite, metre > 0 else { return "—" }
        if metre < 1000 { return "\(Int(metre.rounded())) m" }
        return KBNumberFormat.miktar((metre / 1000).rounded(toPlaces: 2), birim: "km")
    }

    static func merkez(_ coordinates: [KBCoordinate]) -> KBCoordinate? {
        guard !coordinates.isEmpty else { return nil }
        let lat = coordinates.reduce(0) { $0 + $1.lat } / Double(coordinates.count)
        let lng = coordinates.reduce(0) { $0 + $1.lng } / Double(coordinates.count)
        return KBCoordinate(lat: lat, lng: lng)
    }
}

extension Double {
    func rounded(toPlaces places: Int) -> Double {
        let carpan = pow(10, Double(places))
        return (self * carpan).rounded() / carpan
    }
}
