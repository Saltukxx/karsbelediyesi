import CoreLocation
import Foundation
import MapKit

enum AppConfig {
    static var baseURL: URL {
        #if DEBUG
        URL(string: "http://localhost:3000")!
        #else
        URL(string: "https://karsbelediyesi.gbsoftt.com")!
        #endif
    }

    static let karsCenter = CLLocationCoordinate2D(latitude: 40.6013, longitude: 43.0975)
    static let karsSpan = MKCoordinateSpan(latitudeDelta: 0.12, longitudeDelta: 0.14)
    static let keychainService = "tr.gov.kars.panel"
    static let productionURL = URL(string: "https://karsbelediyesi.gbsoftt.com")!
}
