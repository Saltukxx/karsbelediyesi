import MapKit
import SwiftUI

/// Haritada çizilen bir çizgi/alan katmanı.
struct KBMapPolyline: Identifiable, Hashable {
    enum Style: String {
        case asfalt
        case kis
        case cop
        case temizlik
        case parsel
        case taslak
        case pasif

        var color: UIColor {
            switch self {
            case .asfalt: return .systemIndigo
            case .kis: return .systemBlue
            case .cop: return .systemGreen
            case .temizlik: return .systemTeal
            case .parsel: return .systemOrange
            case .taslak: return .systemOrange
            case .pasif: return .systemGray
            }
        }

        var lineWidth: CGFloat { self == .taslak ? 4 : 5 }

        var dashPattern: [NSNumber]? {
            switch self {
            case .taslak: return [6, 5]
            case .pasif: return [2, 6]
            default: return nil
            }
        }
    }

    let id: String
    let coordinates: [KBCoordinate]
    var style: Style = .asfalt
    /// Poligon (parsel) çizimlerinde başlangıç ve bitiş birleştirilir.
    var kapali = false
}

/// Haritadaki nokta işareti. `kind` rengi ve simgeyi belirler.
struct KBMapPin: Identifiable, Hashable {
    enum Kind: String {
        case engel
        case sikayet
        case arac
        case taslakNokta
        case parselMerkez

        var color: UIColor {
            switch self {
            case .engel: return .systemRed
            case .sikayet: return .systemPurple
            case .arac: return .systemGreen
            case .taslakNokta: return .systemOrange
            case .parselMerkez: return .systemOrange
            }
        }

        var symbolName: String {
            switch self {
            case .engel: return "exclamationmark.triangle.fill"
            case .sikayet: return "phone.fill"
            case .arac: return "car.fill"
            case .taslakNokta: return "circle.fill"
            case .parselMerkez: return "mappin"
            }
        }

        /// Araç ve şikayet pinleri kalabalıklaşır; kümeleme yalnız onlarda açık.
        var clusteringIdentifier: String? {
            switch self {
            case .arac, .sikayet: return rawValue
            case .engel, .taslakNokta, .parselMerkez: return nil
            }
        }
    }

    let id: String
    let coordinate: KBCoordinate
    var kind: Kind = .engel
    var title: String?
    var subtitle: String?
    /// Komuta ekranı aynı türden pinleri duruma göre boyar (taze/bayat araç,
    /// SLA kovasına göre şikayet); verilmezse türün rengi kullanılır.
    var tint: UIColor?

    var renk: UIColor { tint ?? kind.color }
}

/// Haritayı belirli bir veri kümesine odaklar. `nonce` aynı hedefe yeniden
/// dokunulduğunda da kadrajın tazelenmesini sağlar.
struct KBMapFocus: Equatable {
    let coordinates: [KBCoordinate]
    let nonce: Int

    init(coordinates: [KBCoordinate], nonce: Int = 0) {
        self.coordinates = coordinates
        self.nonce = nonce
    }

    init(coordinate: KBCoordinate, nonce: Int = 0) {
        self.init(coordinates: [coordinate], nonce: nonce)
    }
}

enum KBMapBasemap: String, CaseIterable, Identifiable {
    case standart
    case uydu

    var id: String { rawValue }

    var label: String {
        switch self {
        case .standart: return "Standart"
        case .uydu: return "Uydu"
        }
    }

    var mapType: MKMapType {
        switch self {
        case .standart: return .mutedStandard
        case .uydu: return .hybrid
        }
    }
}

/// Yeniden kullanılabilir harita: çoklu katman, pin kümeleme, polyline çizim
/// ve düzenleme (nokta ekle / taşı / seç), altlık değiştirme.
///
/// Web'de Leaflet'in çizim eklentisiyle yapılan işler MapKit'te elle
/// yazılır: dokunma noktası koordinata çevrilir, taslak noktalar sürüklenebilir
/// işaret olarak eklenir.
struct KBMapView: UIViewRepresentable {
    var polylines: [KBMapPolyline] = []
    var pins: [KBMapPin] = []
    var basemap: KBMapBasemap = .standart
    var showsUserLocation = true

    /// Doluysa çizim modu açıktır; haritaya dokunmak yeni nokta ekler.
    var draft: Binding<[KBCoordinate]>?
    /// Çizim modunda seçili nokta (silme/taşıma için); parent gösterir.
    var seciliNoktaIndex: Binding<Int?>?
    /// Çizim modu kapalıyken haritaya dokunma (parsel sorgusu gibi).
    var onTapCoordinate: ((KBCoordinate) -> Void)?
    var onSelectPin: ((String) -> Void)?
    /// Kadrajın hangi veri değiştiğinde yeniden hesaplanacağını belirler.
    var focusKey: String = ""
    /// Verildiğinde kadraj tüm veri yerine bu noktalara ayarlanır (komuta
    /// ekranında geciken işe / araca dokunma).
    var focus: KBMapFocus?

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.showsCompass = true
        map.showsScale = true
        map.pointOfInterestFilter = .excludingAll

        let tap = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.haritayaDokunuldu(_:))
        )
        tap.delegate = context.coordinator
        map.addGestureRecognizer(tap)
        context.coordinator.map = map
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.parent = self
        map.mapType = basemap.mapType
        map.showsUserLocation = showsUserLocation

        let taslak = draft?.wrappedValue ?? []
        let cizimAcik = draft != nil

        map.removeOverlays(map.overlays)
        for line in polylines where line.coordinates.count >= 2 {
            map.addOverlay(overlay(for: line))
        }
        if taslak.count >= 2 {
            map.addOverlay(
                overlay(
                    for: KBMapPolyline(id: "taslak", coordinates: taslak, style: .taslak)
                )
            )
        }

        map.removeAnnotations(map.annotations.filter { !($0 is MKUserLocation) })
        for pin in pins {
            map.addAnnotation(KBAnnotation(pin: pin))
        }
        for (index, nokta) in taslak.enumerated() {
            map.addAnnotation(
                KBAnnotation(
                    pin: KBMapPin(
                        id: "taslak-\(index)",
                        coordinate: nokta,
                        kind: .taslakNokta,
                        title: "Nokta \(index + 1)",
                        subtitle: cizimAcik ? "Sürükleyerek taşıyın" : nil
                    ),
                    draftIndex: index
                )
            )
        }

        // Odak isteği veri kümesinden bağımsızdır: aynı hedefe tekrar
        // dokunulduğunda da (nonce değişir) kadraj oraya döner.
        if let focus, context.coordinator.sonOdak != focus {
            context.coordinator.sonOdak = focus
            kadrajla(map, noktalar: focus.coordinates, animasyonlu: true)
            return
        }

        // Kadraj yalnız veri kümesi değiştiğinde ayarlanır; kullanıcı haritayı
        // gezdirdikten sonra her yeniden çizimde başa dönmez.
        let anahtar = "\(focusKey)|\(polylines.count)|\(pins.count)"
        guard context.coordinator.sonKadrajAnahtari != anahtar else { return }
        context.coordinator.sonKadrajAnahtari = anahtar
        kadrajla(
            map,
            noktalar: polylines.flatMap(\.coordinates) + pins.map(\.coordinate) + taslak,
            animasyonlu: false
        )
    }

    private func kadrajla(
        _ map: MKMapView,
        noktalar girdi: [KBCoordinate],
        animasyonlu: Bool
    ) {
        var noktalar = girdi
        if noktalar.isEmpty { noktalar = [KBMapView.karsMerkez] }
        let rect = KBMapGeometry.boundingRect(noktalar)
        if rect.isNull { return }
        map.setVisibleMapRect(
            rect,
            edgePadding: UIEdgeInsets(top: 60, left: 40, bottom: 60, right: 40),
            animated: animasyonlu
        )
        if noktalar.count == 1 {
            map.setRegion(
                MKCoordinateRegion(
                    center: noktalar[0].clCoordinate,
                    latitudinalMeters: 1200,
                    longitudinalMeters: 1200
                ),
                animated: animasyonlu
            )
        }
    }

    private func overlay(for line: KBMapPolyline) -> MKPolyline {
        var coords = line.coordinates.map(\.clCoordinate)
        if line.kapali, let ilk = coords.first, coords.count > 2 {
            coords.append(ilk)
        }
        let polyline = MKPolyline(coordinates: coords, count: coords.count)
        polyline.title = line.style.rawValue
        return polyline
    }

    static let karsMerkez = KBCoordinate(lat: 40.6013, lng: 43.0975)

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        var parent: KBMapView
        weak var map: MKMapView?
        var sonKadrajAnahtari: String?
        var sonOdak: KBMapFocus?

        init(parent: KBMapView) {
            self.parent = parent
        }

        @objc func haritayaDokunuldu(_ recognizer: UITapGestureRecognizer) {
            guard let map, recognizer.state == .ended else { return }
            let nokta = recognizer.location(in: map)
            let koordinat = map.convert(nokta, toCoordinateFrom: map)
            let kb = KBCoordinate(lat: koordinat.latitude, lng: koordinat.longitude)

            if let draft = parent.draft {
                draft.wrappedValue.append(kb)
                parent.seciliNoktaIndex?.wrappedValue = draft.wrappedValue.count - 1
            } else {
                parent.onTapCoordinate?(kb)
            }
        }

        /// İşaret üzerine yapılan dokunuşlar seçim olarak işlenir; çizim modunda
        /// yanlışlıkla yeni nokta eklenmesini engeller.
        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldReceive touch: UITouch
        ) -> Bool {
            var view = touch.view
            while let mevcut = view {
                if mevcut is MKAnnotationView { return false }
                view = mevcut.superview
            }
            return true
        }

        func mapView(
            _ mapView: MKMapView,
            rendererFor overlay: MKOverlay
        ) -> MKOverlayRenderer {
            guard let polyline = overlay as? MKPolyline else {
                return MKOverlayRenderer(overlay: overlay)
            }
            let style = KBMapPolyline.Style(rawValue: polyline.title ?? "") ?? .asfalt
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = style.color
            renderer.lineWidth = style.lineWidth
            renderer.lineDashPattern = style.dashPattern
            renderer.lineCap = .round
            return renderer
        }

        func mapView(
            _ mapView: MKMapView,
            viewFor annotation: MKAnnotation
        ) -> MKAnnotationView? {
            guard let kb = annotation as? KBAnnotation else { return nil }
            let id = "kb-pin-\(kb.pin.kind.rawValue)"
            let view =
                mapView.dequeueReusableAnnotationView(withIdentifier: id)
                    as? MKMarkerAnnotationView
                    ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: id)
            view.annotation = annotation
            view.canShowCallout = true
            view.markerTintColor = kb.pin.renk
            view.glyphImage = UIImage(systemName: kb.pin.kind.symbolName)
            view.clusteringIdentifier = kb.pin.kind.clusteringIdentifier
            view.isDraggable = kb.draftIndex != nil
            view.displayPriority = kb.draftIndex == nil ? .defaultHigh : .required
            return view
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            guard let kb = view.annotation as? KBAnnotation else { return }
            if let index = kb.draftIndex {
                parent.seciliNoktaIndex?.wrappedValue = index
            } else {
                parent.onSelectPin?(kb.pin.id)
            }
        }

        /// Taslak noktanın sürüklenerek taşınması bağlı diziyi günceller.
        func mapView(
            _ mapView: MKMapView,
            annotationView view: MKAnnotationView,
            didChange newState: MKAnnotationView.DragState,
            fromOldState oldState: MKAnnotationView.DragState
        ) {
            guard
                newState == .ending,
                let kb = view.annotation as? KBAnnotation,
                let index = kb.draftIndex,
                let draft = parent.draft,
                draft.wrappedValue.indices.contains(index)
            else { return }
            let yeni = view.annotation?.coordinate ?? kb.coordinate
            draft.wrappedValue[index] = KBCoordinate(
                lat: yeni.latitude,
                lng: yeni.longitude
            )
        }
    }
}

/// MapKit tarafındaki işaret; taslak noktalar `draftIndex` taşır.
final class KBAnnotation: NSObject, MKAnnotation {
    let pin: KBMapPin
    let draftIndex: Int?
    @objc dynamic var coordinate: CLLocationCoordinate2D

    var title: String? { pin.title }
    var subtitle: String? { pin.subtitle }

    init(pin: KBMapPin, draftIndex: Int? = nil) {
        self.pin = pin
        self.draftIndex = draftIndex
        self.coordinate = pin.coordinate.clCoordinate
    }
}

enum KBMapGeometry {
    static func boundingRect(_ coordinates: [KBCoordinate]) -> MKMapRect {
        coordinates.reduce(MKMapRect.null) { rect, coordinate in
            let point = MKMapPoint(coordinate.clCoordinate)
            return rect.union(MKMapRect(x: point.x, y: point.y, width: 0, height: 0))
        }
    }
}

extension KBCoordinate {
    var clCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

// MARK: - Çizim yardımcı çubuğu

/// Çizim modundaki ortak kontroller: uzunluk göstergesi, geri al, seçili
/// noktayı sil, tümünü temizle.
struct KBMapDrawBar: View {
    @Binding var noktalar: [KBCoordinate]
    @Binding var seciliIndex: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(
                    "\(noktalar.count) nokta · \(KBGeo.uzunlukMetni(KBGeo.uzunlukMetre(noktalar)))",
                    systemImage: "scribble.variable"
                )
                .font(.caption.weight(.semibold))
                .foregroundStyle(KBTheme.navy)
                Spacer()
            }

            Text("Haritaya dokunarak nokta ekleyin, işareti sürükleyerek taşıyın.")
                .font(.caption2)
                .foregroundStyle(KBTheme.muted)

            HStack(spacing: 8) {
                Button("Son noktayı geri al") {
                    guard !noktalar.isEmpty else { return }
                    noktalar.removeLast()
                    seciliIndex = nil
                }
                .buttonStyle(KBChipButtonStyle(tone: .neutral))
                .disabled(noktalar.isEmpty)

                if let seciliIndex, noktalar.indices.contains(seciliIndex) {
                    Button("Nokta \(seciliIndex + 1)'i sil") {
                        noktalar.remove(at: seciliIndex)
                        self.seciliIndex = nil
                    }
                    .buttonStyle(KBChipButtonStyle(tone: .danger))
                }

                Button("Temizle") {
                    noktalar.removeAll()
                    seciliIndex = nil
                }
                .buttonStyle(KBChipButtonStyle(tone: .warning))
                .disabled(noktalar.isEmpty)
            }
        }
    }
}

/// Altlık seçimi (standart / uydu) — haritanın üstünde segment olarak.
struct KBMapBasemapPicker: View {
    @Binding var basemap: KBMapBasemap

    var body: some View {
        Picker("Altlık", selection: $basemap) {
            ForEach(KBMapBasemap.allCases) { item in
                Text(item.label).tag(item)
            }
        }
        .pickerStyle(.segmented)
    }
}
