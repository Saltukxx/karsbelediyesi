import MapKit
import SwiftUI

struct KarsMapView: UIViewRepresentable {
    var polylines: [MapPolylineLayer] = []
    var pins: [MapPinLayer] = []
    var polygons: [MapPolygonLayer] = []
    var onTap: ((CLLocationCoordinate2D) -> Void)?

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.showsUserLocation = true
        map.setRegion(
            MKCoordinateRegion(center: AppConfig.karsCenter, span: AppConfig.karsSpan),
            animated: false
        )
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        tap.delegate = context.coordinator
        map.addGestureRecognizer(tap)
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.onTap = onTap
        map.removeOverlays(map.overlays)
        map.removeAnnotations(map.annotations.filter { !($0 is MKUserLocation) })
        for line in polylines where line.coordinates.count >= 2 {
            let overlay = MKPolyline(coordinates: line.coordinates, count: line.coordinates.count)
            overlay.title = line.id
            map.addOverlay(overlay)
        }
        for poly in polygons where poly.coordinates.count >= 3 {
            let overlay = MKPolygon(coordinates: poly.coordinates, count: poly.coordinates.count)
            overlay.title = poly.id
            map.addOverlay(overlay)
        }
        for pin in pins {
            let ann = MKPointAnnotation()
            ann.coordinate = pin.coordinate
            ann.title = pin.title
            ann.subtitle = pin.subtitle
            map.addAnnotation(ann)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        var onTap: ((CLLocationCoordinate2D) -> Void)?

        @objc func tapped(_ g: UITapGestureRecognizer) {
            guard let map = g.view as? MKMapView else { return }
            let point = g.location(in: map)
            onTap?(map.convert(point, toCoordinateFrom: map))
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            !(touch.view is MKAnnotationView)
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let line = overlay as? MKPolyline {
                let r = MKPolylineRenderer(polyline: line)
                r.strokeColor = line.title == "servis" ? .systemOrange : .systemBlue
                r.lineWidth = 4
                return r
            }
            if let poly = overlay as? MKPolygon {
                let r = MKPolygonRenderer(polygon: poly)
                r.fillColor = UIColor.systemGreen.withAlphaComponent(0.25)
                r.strokeColor = .systemGreen
                r.lineWidth = 2
                return r
            }
            return MKOverlayRenderer(overlay: overlay)
        }
    }
}

struct MapPolylineLayer: Identifiable {
    let id: String
    let coordinates: [CLLocationCoordinate2D]
}

struct MapPinLayer: Identifiable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let title: String
    let subtitle: String?
}

struct MapPolygonLayer: Identifiable {
    let id: String
    let coordinates: [CLLocationCoordinate2D]
}

func coordsFromPairs(_ raw: [[Double]]?) -> [CLLocationCoordinate2D] {
    (raw ?? []).compactMap { pair in
        guard pair.count == 2 else { return nil }
        return CLLocationCoordinate2D(latitude: pair[0], longitude: pair[1])
    }
}
