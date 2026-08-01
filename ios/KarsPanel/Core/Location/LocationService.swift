import CoreLocation
import Foundation

/// Şoför telefonundan periyodik konum gönderimi (dispatch için canlı araç konumu).
///
/// İzin "her zaman"a yükseltilebilirse arka planda da gönderim sürer: araç
/// hareket ettikçe gelen güncellemeler, hareketsizken de 60 sn'lik zamanlayıcı
/// ping atar. Uygulama sistem tarafından kapatılırsa önemli konum değişimi
/// izlemesi onu yeniden ayağa kaldırır.
@MainActor
final class LocationService: NSObject, ObservableObject {
    static let shared = LocationService()

    private static let pingInterval: TimeInterval = 60
    private static let defaultsKey = "konumPaylasimiAcik"

    @Published private(set) var isSharing = false
    @Published private(set) var lastSentAt: Date?
    @Published private(set) var authorizationDenied = false
    @Published private(set) var authorizationStatus: CLAuthorizationStatus = .notDetermined

    private let manager = CLLocationManager()
    private var timer: Timer?
    private var lastLocation: CLLocation?
    /// "Her zaman" izni yalnızca bir kez istenir; her açılışta sorulması
    /// kullanıcıyı bunaltır ve sistem ikinci istemi göstermez.
    private var alwaysIstendi = false

    override private init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = 25
        // Duraklatma, aracın park süresinden sonra güncellemelerin hiç
        // dönmemesine yol açıyordu.
        manager.pausesLocationUpdatesAutomatically = false
        manager.activityType = .automotiveNavigation
        authorizationStatus = manager.authorizationStatus
    }

    /// Kullanıcı tercihi (kalıcı) — şoför girişinde otomatik başlatma için
    var preferenceEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: Self.defaultsKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.defaultsKey) }
    }

    /// Arka planda gönderim yalnızca "her zaman" izniyle mümkündür.
    var arkaPlandaCalisiyor: Bool {
        isSharing && authorizationStatus == .authorizedAlways
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
        arkaPlanIzniniYukselt()
        timer = Timer.scheduledTimer(withTimeInterval: Self.pingInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.sendPing() }
        }
        // İlk konumu beklemeden bir deneme yap
        sendPing()
    }

    /// Kullanıcı anahtarı kapattığında: paylaşım tamamen durur.
    func stop() {
        preferenceEnabled = false
        duraklat()
    }

    /// Oturum kapanışı gibi durumlarda: gönderim durur ama şoförün tercihi
    /// korunur, sonraki girişte kendiliğinden devam eder.
    func duraklat() {
        timer?.invalidate()
        timer = nil
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
        manager.allowsBackgroundLocationUpdates = false
        isSharing = false
    }

    private func arkaPlanIzniniYukselt() {
        switch manager.authorizationStatus {
        case .authorizedAlways:
            arkaPlaniAc()
        case .authorizedWhenInUse:
            guard !alwaysIstendi else { return }
            alwaysIstendi = true
            manager.requestAlwaysAuthorization()
        default:
            break
        }
    }

    /// `allowsBackgroundLocationUpdates` yalnızca Info.plist'te `location`
    /// arka plan kipi tanımlıysa ve izin "her zaman" ise kabul edilir; aksi
    /// halde CoreLocation çalışma zamanında istisna atar.
    private func arkaPlaniAc() {
        guard manager.authorizationStatus == .authorizedAlways else { return }
        manager.allowsBackgroundLocationUpdates = true
        manager.startMonitoringSignificantLocationChanges()
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

    /// Araç hareket hâlindeyken zamanlayıcıyı beklemeden gönderim yapar;
    /// arka planda zamanlayıcı ertelense de konum akışı sürer.
    private func hareketPingi() {
        guard isSharing else { return }
        if let lastSentAt, Date().timeIntervalSince(lastSentAt) < Self.pingInterval { return }
        sendPing()
    }
}

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        Task { @MainActor in
            self.lastLocation = latest
            self.hareketPingi()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            self.authorizationStatus = status
            switch status {
            case .denied, .restricted:
                self.authorizationDenied = true
                self.stop()
            case .authorizedAlways:
                self.authorizationDenied = false
                if self.isSharing { self.arkaPlaniAc() }
            default:
                self.authorizationDenied = false
            }
        }
    }
}
