import MapKit
import SwiftUI
import UIKit

/// Şikayet konumlarının coğrafi yoğunluğu.
///
/// Web tarafı `leaflet.heat` kullanıyor; burada aynı görünüm MapKit üzerinde
/// özel bir `MKOverlayRenderer` ile üretilir. Noktalar önce gri tonlamalı bir
/// yoğunluk tamponuna toplanır, sonra bu yoğunluk `KBChart.isi` rampasından
/// geçirilerek renklendirilir. Tek tek işaretçi koymak yerine bu yol seçildi,
/// çünkü yüzlerce nokta pin olarak okunamıyor.
final class ComplaintHeatOverlay: NSObject, MKOverlay {
    let points: [CLLocationCoordinate2D]
    let coordinate: CLLocationCoordinate2D
    let boundingMapRect: MKMapRect

    init?(coordinates: [CLLocationCoordinate2D]) {
        guard !coordinates.isEmpty else { return nil }

        var rect = MKMapRect.null
        for coordinate in coordinates {
            let point = MKMapPoint(coordinate)
            rect = rect.union(MKMapRect(origin: point, size: MKMapSize(width: 0, height: 0)))
        }
        // Kenarlardaki lekeler kırpılmasın diye sınır kutusu genişletilir.
        let payX = max(rect.size.width * 0.35, 2000)
        let payY = max(rect.size.height * 0.35, 2000)

        points = coordinates
        boundingMapRect = rect.insetBy(dx: -payX, dy: -payY)
        coordinate = MKMapPoint(
            x: rect.midX,
            y: rect.midY
        ).coordinate

        super.init()
    }
}

final class ComplaintHeatRenderer: MKOverlayRenderer {
    /// Lekenin ekran üzerindeki yarıçapı; zoom'dan bağımsız sabit kalır.
    private let blobRadius: CGFloat = 20

    /// Tek noktanın tepe yoğunluğu.
    ///
    /// Sabit bir değer nokta sayısına göre ya hiç görünmüyor ya da her yeri
    /// doyurup tek bir koyu leke bırakıyor. Bu yüzden nokta sayısının kareköküne
    /// göre ölçeklenir: yoğun ilçelerde bile rampanın tamamı kullanılabilir kalır.
    private var blobPeak: CGFloat {
        let sayi = max(heatOverlay?.points.count ?? 1, 1)
        return min(max(1.6 / sqrt(CGFloat(sayi)), 0.06), 0.5)
    }

    private var heatOverlay: ComplaintHeatOverlay? {
        overlay as? ComplaintHeatOverlay
    }

    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        guard let heatOverlay, !heatOverlay.points.isEmpty else { return }

        let tileRect = rect(for: mapRect)
        let width = Int((tileRect.width * zoomScale).rounded())
        let height = Int((tileRect.height * zoomScale).rounded())
        guard width > 0, height > 0, width <= 2048, height <= 2048 else { return }

        guard let densityImage = yogunlukGorseli(
            width: width,
            height: height,
            tileRect: tileRect,
            zoomScale: zoomScale,
            points: heatOverlay.points
        ) else { return }

        // MapKit'in bağlamında y aşağı doğru artar; CGImage ters çizilmesin diye
        // çizimden önce eksen geri çevrilir.
        context.saveGState()
        context.setBlendMode(.normal)
        context.translateBy(x: tileRect.minX, y: tileRect.minY + tileRect.height)
        context.scaleBy(x: 1, y: -1)
        context.draw(densityImage, in: CGRect(origin: .zero, size: tileRect.size))
        context.restoreGState()
    }

    private func yogunlukGorseli(
        width: Int,
        height: Int,
        tileRect: CGRect,
        zoomScale: MKZoomScale,
        points: [CLLocationCoordinate2D]
    ) -> CGImage? {
        let bytesPerRow = width * 4
        guard let density = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        // Ekran yönüyle aynı çalışmak için y ekseni çevrilir.
        density.translateBy(x: 0, y: CGFloat(height))
        density.scaleBy(x: 1, y: -1)
        density.setBlendMode(.plusLighter)

        guard let gradient = CGGradient(
            colorsSpace: CGColorSpaceCreateDeviceRGB(),
            colors: [
                UIColor(white: 1, alpha: blobPeak).cgColor,
                UIColor(white: 1, alpha: 0).cgColor,
            ] as CFArray,
            locations: [0, 1]
        ) else { return nil }

        var cizildi = false
        for coordinate in points {
            let overlayPoint = point(for: MKMapPoint(coordinate))
            let x = (overlayPoint.x - tileRect.minX) * zoomScale
            let y = (overlayPoint.y - tileRect.minY) * zoomScale
            guard x > -blobRadius, y > -blobRadius,
                  x < CGFloat(width) + blobRadius,
                  y < CGFloat(height) + blobRadius
            else { continue }

            let center = CGPoint(x: x, y: y)
            density.drawRadialGradient(
                gradient,
                startCenter: center,
                startRadius: 0,
                endCenter: center,
                endRadius: blobRadius,
                options: []
            )
            cizildi = true
        }

        guard cizildi, let buffer = density.data else { return nil }
        return renklendir(buffer: buffer, width: width, height: height, bytesPerRow: bytesPerRow)
    }

    /// Gri yoğunluk tamponunu panelin ısı rampasına eşler.
    private func renklendir(
        buffer: UnsafeMutableRawPointer,
        width: Int,
        height: Int,
        bytesPerRow: Int
    ) -> CGImage? {
        let pixelCount = width * height
        let source = buffer.bindMemory(to: UInt8.self, capacity: pixelCount * 4)
        var output = [UInt8](repeating: 0, count: pixelCount * 4)

        for index in 0..<pixelCount {
            let offset = index * 4
            let yogunluk = Double(source[offset + 3]) / 255.0
            guard yogunluk > 0.02 else { continue }

            let (r, g, b) = KBChart.isiBilesenleri(min(yogunluk * 1.3, 1))
            let alpha = min(yogunluk * 1.45, 0.8)
            output[offset] = UInt8((r * alpha * 255).rounded())
            output[offset + 1] = UInt8((g * alpha * 255).rounded())
            output[offset + 2] = UInt8((b * alpha * 255).rounded())
            output[offset + 3] = UInt8((alpha * 255).rounded())
        }

        guard let provider = CGDataProvider(data: Data(output) as CFData) else { return nil }
        return CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider,
            decode: nil,
            shouldInterpolate: true,
            intent: .defaultIntent
        )
    }
}

struct ComplaintHeatMapView: UIViewRepresentable {
    let coordinates: [CLLocationCoordinate2D]

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.isZoomEnabled = false
        map.isScrollEnabled = false
        map.isRotateEnabled = false
        map.isPitchEnabled = false
        map.pointOfInterestFilter = .excludingAll

        // Sade harita zemini ısı lekelerinin okunmasını kolaylaştırır.
        let configuration = MKStandardMapConfiguration(elevationStyle: .flat)
        configuration.pointOfInterestFilter = .excludingAll
        map.preferredConfiguration = configuration

        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        map.removeOverlays(map.overlays)
        guard let overlay = ComplaintHeatOverlay(coordinates: coordinates) else { return }
        map.addOverlay(overlay, level: .aboveRoads)
        map.setVisibleMapRect(
            overlay.boundingMapRect,
            edgePadding: UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12),
            animated: false
        )
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let heat = overlay as? ComplaintHeatOverlay {
                return ComplaintHeatRenderer(overlay: heat)
            }
            return MKOverlayRenderer(overlay: overlay)
        }
    }
}

struct DashboardHeatMapCard: View {
    let coordinates: [DashboardCoordinateDTO]

    var body: some View {
        KBChartCard(
            title: "Şikayet yoğunluk haritası",
            description: "Seçili dönemde konumu girilen şikayetlerin coğrafi dağılımı",
            isEmpty: coordinates.isEmpty,
            emptyText: "Konumu girilmiş şikayet yok",
            destination: .harita
        ) {
            NavigationLink {
                DestinationView(destination: .harita)
            } label: {
                ComplaintHeatMapView(
                    coordinates: coordinates.map {
                        CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng)
                    }
                )
                .frame(height: 200)
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
                .overlay(
                    RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                        .stroke(KBTheme.border, lineWidth: 1)
                )
                .overlay(alignment: .bottomTrailing) {
                    Text("\(KBChartFormat.adet(coordinates.count)) konum")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(KBTheme.navy)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(KBTheme.card.opacity(0.92))
                        .clipShape(Capsule())
                        .padding(8)
                }
            }
            .buttonStyle(.plain)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Şikayet yoğunluk haritası, \(coordinates.count) konum")
    }
}
