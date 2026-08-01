import MapKit
import SwiftUI

/// `/gorevler/[id]/takip` — planlanan rota ↔ GPS izi karşılaştırması,
/// KPI kartları, harita ve zaman çizelgesi.
struct TaskTrackReportView: View {
    let taskId: String

    @StateObject private var viewModel: TaskTrackReportViewModel

    init(taskId: String, api: APIClient = .shared) {
        self.taskId = taskId
        _viewModel = StateObject(
            wrappedValue: TaskTrackReportViewModel(taskId: taskId, api: api)
        )
    }

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if let rapor = viewModel.rapor {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(rapor.baslikAltMetni)
                            .font(.subheadline)
                            .foregroundStyle(KBTheme.muted)
                        if let guncelleme = rapor.analiz?.guncellemeTarihi {
                            Text("Son analiz: \(guncelleme.kbAn)")
                                .font(.caption)
                                .foregroundStyle(KBTheme.muted)
                        }
                    }
                }

                if !rapor.dispatchVar {
                    Section {
                        Text(
                            "Bu görev bir dispatch rotasına bağlı değil; rota takip "
                                + "analizi yalnızca kış / çöp / yol temizliği rotalarına "
                                + "atanan görevler için üretilir."
                        )
                        .font(.subheadline)
                        .foregroundStyle(KBTheme.muted)
                    }
                } else if let analiz = rapor.analiz {
                    Section {
                        durumRozetleri(analiz)
                    }

                    if analiz.veriYok {
                        Section {
                            Text(
                                "Görev süresi içinde bu araçtan GPS verisi bulunamadı. "
                                    + "Veri geldiğinde yeniden analiz ile rapor üretilebilir."
                            )
                            .font(.subheadline)
                            .foregroundStyle(KBTheme.muted)
                        }
                    } else {
                        Section("Özet") {
                            KBStatRow(tiles: viewModel.kpiler)
                                .listRowInsets(
                                    EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
                                )
                        }

                        if let harita = rapor.harita {
                            Section("Harita") {
                                TrackReportMap(
                                    harita: harita,
                                    sapmalar: rapor.sapmalar,
                                    duraklamalar: rapor.duraklamalar
                                )
                                .frame(height: 320)
                                .clipShape(
                                    RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                                )
                                .listRowInsets(
                                    EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
                                )
                                TrackMapLegend()
                            }
                        }

                        Section("Zaman Çizelgesi") {
                            if rapor.zamanCizelgesi.isEmpty {
                                Text(
                                    "Kayda değer olay yok "
                                        + "(sapma/duraklama/boşluk tespit edilmedi)."
                                )
                                .font(.subheadline)
                                .foregroundStyle(KBTheme.muted)
                            } else {
                                ForEach(rapor.zamanCizelgesi) { olay in
                                    TrackEventRow(olay: olay)
                                }
                            }
                        }
                    }
                } else {
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Henüz analiz yok")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(KBTheme.navy)
                            Text(
                                "Analiz görev kapanışında otomatik üretilir. GPS verisi "
                                    + "geldiyse yeniden analiz ile şimdi üretebilirsiniz."
                            )
                            .font(.caption)
                            .foregroundStyle(KBTheme.muted)
                        }
                    }
                }

                Section {
                    Button("Yeniden Analiz Et") {
                        Task { await viewModel.yenidenAnaliz() }
                    }
                    .buttonStyle(KBPrimaryButtonStyle(filled: false))
                    .disabled(viewModel.isAnalyzing)
                    if viewModel.isAnalyzing {
                        HStack { Spacer(); ProgressView(); Spacer() }
                    }
                } footer: {
                    Text("GPS verisi sonradan geldiyse raporu yeniden üretir.")
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(
            viewModel.rapor.map { "Takip — \($0.gorevNo)" } ?? "Takip Raporu"
        )
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await viewModel.load() }
        .task { if viewModel.rapor == nil { await viewModel.load() } }
        .overlay {
            if viewModel.isLoading, viewModel.rapor == nil { LoadingOverlay() }
        }
    }

    @ViewBuilder
    private func durumRozetleri(_ analiz: TaskTrackAnalysisDTO) -> some View {
        let sonuc = TrackReportLabels.sonuc(analiz.sonuc)
        let kalite = TrackReportLabels.veriKalitesi(analiz.veriKalitesi)
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                StatusBadge(text: sonuc.label, tone: sonuc.tone.badge)
                StatusBadge(text: kalite.label, tone: kalite.tone.badge)
                Spacer(minLength: 0)
            }
            if let notlar = analiz.notlar, !notlar.isEmpty {
                Text(notlar)
                    .font(.caption)
                    .foregroundStyle(KBTheme.warning)
            }
        }
    }
}

/// Zaman çizelgesi satırı: saat, olay adı ve süre/mesafe detayı.
private struct TrackEventRow: View {
    let olay: TrackEventDTO

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(olay.baslangicMs.kbEpochMsSaat)
                .font(.caption.monospacedDigit())
                .foregroundStyle(KBTheme.muted)
                .frame(width: 46, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(olay.olay?.displayName ?? olay.tip)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle((olay.olay?.badgeTone ?? .neutral).progressColor)
                if let detay = detayMetni {
                    Text(detay)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var detayMetni: String? {
        var parcalar: [String] = []
        if let bitis = olay.bitisMs {
            parcalar.append("\(olay.baslangicMs.kbEpochMsSaat) → \(bitis.kbEpochMsSaat)")
        }
        if let sure = olay.sureDk {
            parcalar.append(KBDurationFormat.dakika(sure))
        }
        if let mesafe = olay.maxMesafeM {
            parcalar.append("en fazla \(KBNumberFormat.miktar(mesafe, birim: "m"))")
        }
        return parcalar.isEmpty ? nil : parcalar.joined(separator: " · ")
    }
}

private struct TrackMapLegend: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            legendRow(color: KBTheme.info, text: "Planlanan rota")
            legendRow(color: KBTheme.danger, text: "Kat edilmeyen bölüm")
            legendRow(color: KBTheme.success, text: "GPS izi")
            legendRow(color: KBTheme.warning, text: "Sapma ve duraklama noktaları")
        }
        .font(.caption)
        .foregroundStyle(KBTheme.muted)
    }

    private func legendRow(color: Color, text: String) -> some View {
        HStack(spacing: 8) {
            Capsule().fill(color).frame(width: 18, height: 4)
            Text(text)
        }
    }
}

@MainActor
final class TaskTrackReportViewModel: ObservableObject {
    @Published private(set) var rapor: TaskTrackReportDTO?
    @Published private(set) var isLoading = false
    @Published private(set) var isAnalyzing = false
    @Published var errorMessage: String?

    private let taskId: String
    private let api: APIClient

    init(taskId: String, api: APIClient = .shared) {
        self.taskId = taskId
        self.api = api
    }

    /// Web KPI kartlarıyla aynı sıra ve içerik.
    var kpiler: [KBStat] {
        guard let rapor, let analiz = rapor.analiz else { return [] }
        return [
            KBStat(label: "Rotada kalma uyumu", value: KBNumberFormat.yuzde(analiz.uyumYuzde)),
            KBStat(label: "Rota kapsaması", value: KBNumberFormat.yuzde(analiz.kapsamaYuzde)),
            KBStat(label: "Rotaya giriş", value: analiz.rotaGiris.kbAn),
            KBStat(label: "Rotadan çıkış", value: analiz.rotaCikis.kbAn),
            KBStat(label: "Rota üzerindeki süre", value: KBDurationFormat.dakika(analiz.sureDk)),
            KBStat(
                label: "Toplam mesafe",
                value: KBNumberFormat.miktar(analiz.toplamMesafeKm, birim: "km")
            ),
            KBStat(
                label: "Ortalama / maks hız",
                value: "\(hiz(analiz.ortalamaHizKmh)) / \(hiz(analiz.maxHizKmh))"
            ),
            KBStat(
                label: "Ortalama / maks sapma",
                value: "\(mesafe(analiz.ortSapmaM)) / \(mesafe(analiz.maxSapmaM))"
            ),
            KBStat(
                label: "Sapma",
                value: "\(rapor.sapmalar.count) olay",
                tone: rapor.sapmalar.isEmpty ? .neutral : .warning
            ),
            KBStat(
                label: "Rota dışı süre",
                value: KBDurationFormat.dakika(rapor.toplamSapmaDk)
            ),
            KBStat(
                label: "Duraklama",
                value: "\(rapor.duraklamalar.count) kez",
                tone: .info
            ),
            KBStat(
                label: "Toplam duraklama",
                value: KBDurationFormat.dakika(rapor.toplamDuraklamaDk)
            ),
            KBStat(label: "Ping", value: analiz.pingSayisi.map(String.init) ?? "—"),
            KBStat(
                label: "Ortalama ping aralığı",
                value: analiz.ortPingAraligiSn.map { "\(Int($0.rounded())) sn" } ?? "—"
            ),
            KBStat(
                label: "Veri boşluğu",
                value: "\(rapor.veriBosluklari.count)",
                tone: rapor.veriBosluklari.isEmpty ? .neutral : .accent
            ),
        ]
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            rapor = try await api.fetchTaskTrackReport(id: taskId)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func yenidenAnaliz() async {
        isAnalyzing = true
        errorMessage = nil
        do {
            rapor = try await api.reanalyzeTaskTrack(id: taskId)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isAnalyzing = false
    }

    private func hiz(_ value: Double?) -> String {
        value.map { KBNumberFormat.miktar($0) } ?? "—"
    }

    private func mesafe(_ value: Double?) -> String {
        value.map { KBNumberFormat.miktar($0, birim: "m") } ?? "—"
    }
}

// MARK: - Harita

/// Planlanan rota, eksik segmentler, GPS izi ve olay noktaları tek haritada.
/// Web'deki Leaflet `TrackReportPanel` katmanlarının MapKit karşılığı.
private struct TrackReportMap: UIViewRepresentable {
    let harita: TrackMapDTO
    let sapmalar: [TrackDeviationDTO]
    let duraklamalar: [TrackStopDTO]

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.isRotateEnabled = false
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        map.removeOverlays(map.overlays)
        map.removeAnnotations(map.annotations)

        var tumNoktalar: [CLLocationCoordinate2D] = []

        let planlanan = TrackMapGeometry.coordinates(harita.planlanan)
        ekle(planlanan, kind: .planlanan, to: map, points: &tumNoktalar)

        for segment in harita.eksikSegmentler {
            ekle(
                TrackMapGeometry.coordinates(segment),
                kind: .eksik,
                to: map,
                points: &tumNoktalar
            )
        }

        let iz = TrackMapGeometry.coordinates(harita.izNoktalari)
        ekle(iz, kind: .iz, to: map, points: &tumNoktalar)

        for sapma in sapmalar {
            let pin = TrackAnnotation(
                coordinate: CLLocationCoordinate2D(
                    latitude: sapma.lat,
                    longitude: sapma.lng
                ),
                kind: .sapma,
                title: "Sapma",
                subtitle: "\(KBDurationFormat.dakika(sapma.sureDk))"
                    + " · en fazla \(Int(sapma.maxMesafeM.rounded())) m"
            )
            map.addAnnotation(pin)
        }

        for durak in duraklamalar {
            let pin = TrackAnnotation(
                coordinate: CLLocationCoordinate2D(
                    latitude: durak.lat,
                    longitude: durak.lng
                ),
                kind: durak.rotaUzerinde ? .durakRotada : .durakRotaDisi,
                title: durak.rotaUzerinde ? "Duraklama (rotada)" : "Duraklama (rota dışı)",
                subtitle: KBDurationFormat.dakika(durak.sureDk)
            )
            map.addAnnotation(pin)
        }

        guard !tumNoktalar.isEmpty, !context.coordinator.kadrajAyarlandi else { return }
        context.coordinator.kadrajAyarlandi = true
        map.setVisibleMapRect(
            TrackMapGeometry.boundingRect(tumNoktalar),
            edgePadding: UIEdgeInsets(top: 40, left: 30, bottom: 40, right: 30),
            animated: false
        )
    }

    private func ekle(
        _ coordinates: [CLLocationCoordinate2D],
        kind: TrackPolylineKind,
        to map: MKMapView,
        points: inout [CLLocationCoordinate2D]
    ) {
        guard coordinates.count >= 2 else { return }
        let line = MKPolyline(coordinates: coordinates, count: coordinates.count)
        line.title = kind.rawValue
        map.addOverlay(line)
        points.append(contentsOf: coordinates)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, MKMapViewDelegate {
        /// Kullanıcı haritayı gezdirdikten sonra yeniden çizimde kadraj sıfırlanmaz.
        var kadrajAyarlandi = false

        func mapView(
            _ mapView: MKMapView,
            rendererFor overlay: MKOverlay
        ) -> MKOverlayRenderer {
            guard let polyline = overlay as? MKPolyline else {
                return MKOverlayRenderer(overlay: overlay)
            }
            let renderer = MKPolylineRenderer(polyline: polyline)
            let kind = TrackPolylineKind(rawValue: polyline.title ?? "") ?? .planlanan
            renderer.strokeColor = kind.color
            renderer.lineWidth = kind.lineWidth
            renderer.lineDashPattern = kind.dashPattern
            renderer.lineCap = .round
            return renderer
        }

        func mapView(
            _ mapView: MKMapView,
            viewFor annotation: MKAnnotation
        ) -> MKAnnotationView? {
            guard let nokta = annotation as? TrackAnnotation else { return nil }
            let id = "track-event"
            let view =
                mapView.dequeueReusableAnnotationView(withIdentifier: id)
                    as? MKMarkerAnnotationView
                    ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: id)
            view.annotation = annotation
            view.canShowCallout = true
            view.markerTintColor = nokta.kind.color
            view.glyphImage = UIImage(systemName: nokta.kind.symbolName)
            view.displayPriority = .defaultHigh
            return view
        }
    }
}

private enum TrackPolylineKind: String {
    case planlanan
    case eksik
    case iz

    var color: UIColor {
        switch self {
        case .planlanan: return .systemBlue
        case .eksik: return .systemRed
        case .iz: return .systemGreen
        }
    }

    var lineWidth: CGFloat {
        switch self {
        case .planlanan: return 5
        case .eksik: return 5
        case .iz: return 3
        }
    }

    var dashPattern: [NSNumber]? {
        self == .eksik ? [4, 6] : nil
    }
}

private final class TrackAnnotation: NSObject, MKAnnotation {
    enum Kind {
        case sapma
        case durakRotada
        case durakRotaDisi

        var color: UIColor {
            switch self {
            case .sapma: return .systemOrange
            case .durakRotada: return .systemTeal
            case .durakRotaDisi: return .systemRed
            }
        }

        var symbolName: String {
            switch self {
            case .sapma: return "arrow.triangle.branch"
            case .durakRotada, .durakRotaDisi: return "pause.circle"
            }
        }
    }

    let coordinate: CLLocationCoordinate2D
    let kind: Kind
    let title: String?
    let subtitle: String?

    init(
        coordinate: CLLocationCoordinate2D,
        kind: Kind,
        title: String?,
        subtitle: String?
    ) {
        self.coordinate = coordinate
        self.kind = kind
        self.title = title
        self.subtitle = subtitle
    }
}

/// Sunucu koordinatları `[[lat, lng]]` biçiminde gelir.
enum TrackMapGeometry {
    static func coordinates(_ raw: [[Double]]) -> [CLLocationCoordinate2D] {
        raw.compactMap { pair in
            guard pair.count >= 2 else { return nil }
            return CLLocationCoordinate2D(latitude: pair[0], longitude: pair[1])
        }
    }

    static func boundingRect(_ coordinates: [CLLocationCoordinate2D]) -> MKMapRect {
        coordinates.reduce(MKMapRect.null) { rect, coordinate in
            let point = MKMapPoint(coordinate)
            return rect.union(
                MKMapRect(x: point.x, y: point.y, width: 0, height: 0)
            )
        }
    }
}
