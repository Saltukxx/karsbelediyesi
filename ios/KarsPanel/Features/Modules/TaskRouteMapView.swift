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

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                RoutePolylineMap(gidis: gidis, servis: servis)
                    .ignoresSafeArea(edges: .bottom)

                VStack(alignment: .leading, spacing: 8) {
                    if let rota = task.rota, let sure = rota.sureDk, let mesafe = rota.mesafeKm {
                        Text("Tahmini varış: \(Int(sure.rounded())) dk · \(String(format: "%.1f", mesafe)) km\(rota.tahmini == true ? " (kuş uçuşu tahmini)" : "")")
                            .font(.caption)
                            .foregroundStyle(KBTheme.muted)
                    }
                    if let hedef {
                        Button {
                            navigasyonBaslat(hedef)
                        } label: {
                            Label("Navigasyonu başlat", systemImage: "arrow.triangle.turn.up.right.circle.fill")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(KBTheme.navy)
                    }
                }
                .padding(16)
                .background(KBTheme.card)
            }
            .navigationTitle(task.gorevNo ?? "Görev rotası")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                }
            }
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
