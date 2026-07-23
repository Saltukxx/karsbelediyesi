import CoreLocation
import Foundation

/// Şoför telefonundan periyodik konum gönderimi (dispatch için canlı araç konumu).
/// Uygulama ön plandayken PING_ARALIGI'nda bir `/api/mobile/location`a gönderir.
@MainActor
final class LocationService: NSObject, ObservableObject {
    static let shared = LocationService()

    private static let pingInterval: TimeInterval = 60
    private static let defaultsKey = "konumPaylasimiAcik"

    @Published private(set) var isSharing = false
    @Published private(set) var lastSentAt: Date?
    @Published private(set) var authorizationDenied = false

    private let manager = CLLocationManager()
    private var timer: Timer?
    private var lastLocation: CLLocation?

    override private init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = 25
    }

    /// Kullanıcı tercihi (kalıcı) — şoför girişinde otomatik başlatma için
    var preferenceEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: Self.defaultsKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.defaultsKey) }
    }

    func start() {
        guard !isSharing else { return }
        preferenceEnabled = true
        authorizationDenied = false

        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            authorizationDenied = true
            return
        default:
            break
        }

        manager.startUpdatingLocation()
        isSharing = true
        timer = Timer.scheduledTimer(withTimeInterval: Self.pingInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.sendPing() }
        }
        // İlk konumu beklemeden bir deneme yap
        sendPing()
    }

    func stop() {
        preferenceEnabled = false
        timer?.invalidate()
        timer = nil
        manager.stopUpdatingLocation()
        isSharing = false
    }

    private func sendPing() {
        guard let loc = lastLocation else { return }
        let hizKmh = loc.speed >= 0 ? loc.speed * 3.6 : nil
        Task {
            do {
                try await APIClient.shared.sendLocation(
                    lat: loc.coordinate.latitude,
                    lng: loc.coordinate.longitude,
                    hiz: hizKmh
                )
                lastSentAt = Date()
            } catch {
                // Ağ hatası ping'i düşürür; bir sonraki denemede tekrar gönderilir
            }
        }
    }
}

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        Task { @MainActor in self.lastLocation = latest }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            if status == .denied || status == .restricted {
                self.authorizationDenied = true
                self.stop()
            }
        }
    }
}
