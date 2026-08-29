import MapKit
import SwiftUI

/// Dispatch'li görevin harita ekranı: gidiş rotası (mavi) + servis rotası (turuncu).
/// "Navigasyonu başlat" işin başlangıç noktasını Apple Haritalar'a devreder.
struct TaskRouteMapView: View {
    let task: VehicleTaskDTO
    @Environment(\.dismiss) private var dismiss

    private var gidis: [CLLocationCoordinate2D] {
        coords(task.rota?.gidis)
    }

    private var servis: [CLLocationCoordinate2D] {
        coords(task.rota?.servis)
    }

    /// Navigasyon hedefi: servis rotasının başı, yoksa gidişin sonu
    private var hedef: CLLocationCoordinate2D? {
        servis.first ?? gidis.last
    }

    /// Başlık altındaki özet: süre, mesafe ve tahmin uyarısı.
    private var ozet: String? {
        guard let rota = task.rota, let sure = rota.sureDk, let mesafe = rota.mesafeKm else {
            return nil
        }
        let tahmin = rota.tahmini == true ? " (kuş uçuşu tahmini)" : ""
        return "Tahmini varış: \(Int(sure.rounded())) dk · \(String(format: "%.1f", mesafe)) km\(tahmin)"
    }

    var body: some View {
        VStack(spacing: 0) {
            baslik

            RoutePolylineMap(gidis: gidis, servis: servis)

            if let hedef {
                navigasyonBari(hedef)
            }
        }
        .background(KBTheme.background)
    }

    private var baslik: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(task.gorevNo ?? "Görev rotası")
                    .font(.headline)
                    .foregroundStyle(.white)
                if let ozet {
                    Text(ozet)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.72))
                }
            }
            Spacer(minLength: 8)
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Kapat")
        }
        .padding(.leading, 16)
        .padding(.trailing, 4)
        .padding(.vertical, 12)
        .background(KBTheme.navy)
    }

    private func navigasyonBari(_ hedef: CLLocationCoordinate2D) -> some View {
        Button {
            navigasyonBaslat(hedef)
        } label: {
            Label("Navigasyonu başlat", systemImage: "arrow.triangle.turn.up.right.circle.fill")
        }
        .buttonStyle(KBPrimaryButtonStyle())
        .padding(16)
        .background(KBTheme.card)
        .overlay(alignment: .top) {
            Rectangle().fill(KBTheme.border).frame(height: 1)
        }
    }

    private func coords(_ raw: [[Double]]?) -> [CLLocationCoordinate2D] {
        (raw ?? []).compactMap { pair in
            guard pair.count == 2 else { return nil }
            return CLLocationCoordinate2D(latitude: pair[0], longitude: pair[1])
        }
    }

    private func navigasyonBaslat(_ hedef: CLLocationCoordinate2D) {
        let placemark = MKPlacemark(coordinate: hedef)
        let item = MKMapItem(placemark: placemark)
        item.name = task.aciklama ?? task.gorevNo ?? "Görev"
        item.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving,
        ])
    }
}

/// MKMapView sarmalayıcı — iki polyline (gidiş mavi, servis turuncu)
private struct RoutePolylineMap: UIViewRepresentable {
    let gidis: [CLLocationCoordinate2D]
    let servis: [CLLocationCoordinate2D]

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.showsUserLocation = true
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        map.removeOverlays(map.overlays)
        map.removeAnnotations(map.annotations.filter { !($0 is MKUserLocation) })

        var tumNoktalar: [CLLocationCoordinate2D] = []

        if gidis.count >= 2 {
            let line = MKPolyline(coordinates: gidis, count: gidis.count)
            line.title = "gidis"
            map.addOverlay(line)
            tumNoktalar.append(contentsOf: gidis)
        }
        if servis.count >= 2 {
            let line = MKPolyline(coordinates: servis, count: servis.count)
            line.title = "servis"
            map.addOverlay(line)
            tumNoktalar.append(contentsOf: servis)
        }

        if let hedef = servis.first ?? gidis.last {
            let pin = MKPointAnnotation()
            pin.coordinate = hedef
            pin.title = "İş başlangıcı"
            map.addAnnotation(pin)
        }

        guard !tumNoktalar.isEmpty else { return }
        var zoneRect = MKMapRect.null
        for nokta in tumNoktalar {
            let point = MKMapPoint(nokta)
            zoneRect = zoneRect.union(MKMapRect(x: point.x, y: point.y, width: 0, height: 0))
        }
        map.setVisibleMapRect(
            zoneRect,
            edgePadding: UIEdgeInsets(top: 60, left: 40, bottom: 60, right: 40),
            animated: false
        )
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            guard let polyline = overlay as? MKPolyline else {
                return MKOverlayRenderer(overlay: overlay)
            }
            let renderer = MKPolylineRenderer(polyline: polyline)
            if polyline.title == "servis" {
                renderer.strokeColor = .systemOrange
                renderer.lineWidth = 5
            } else {
                renderer.strokeColor = .systemBlue
                renderer.lineWidth = 4
                renderer.lineDashPattern = [6, 4]
            }
            renderer.lineCap = .round
            return renderer
        }
    }
}
