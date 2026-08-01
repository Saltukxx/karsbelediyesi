import SwiftUI

/// `/harita` — asfalt yollar, engel noktaları, konumu bilinen şikayetler ve
/// canlı araçlar tek haritada. Web'deki Leaflet panelinin native karşılığı.
struct MapScreen: View {
    @StateObject private var viewModel = MapScreenViewModel()
    @ObservedObject private var lookups = LookupStore.shared

    @State private var basemap: KBMapBasemap = .standart
    @State private var tamEkran = false
    @State private var yolFormu = false
    @State private var engelFormu = false
    @State private var secilenYol: AsphaltRoadDTO?

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
            }

            Section {
                VStack(spacing: 10) {
                    KBMapBasemapPicker(basemap: $basemap)
                    MapLayerToggles(katmanlar: $viewModel.katmanlar)
                    harita(yukseklik: 300)
                    Button("Tam Ekran Harita") { tamEkran = true }
                        .buttonStyle(KBChipButtonStyle(tone: .info))
                }
                .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
            }

            Section("Asfalt rotaları (\(viewModel.yollar.count))") {
                if viewModel.yollar.isEmpty {
                    Text("Kayıtlı rota yok").font(.caption).foregroundStyle(KBTheme.muted)
                }
                ForEach(viewModel.yollar) { yol in
                    Button { secilenYol = yol } label: {
                        KBListRow(
                            title: yol.ad,
                            subtitle: yol.mudurluk ?? "Müdürlük atanmamış",
                            detail: yolDetay(yol),
                            badge: yol.durumu?.displayName ?? yol.durum,
                            badgeTone: (yol.durumu?.badgeTone ?? .neutral).badge
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            Section("Engel / çukur (\(viewModel.engeller.count))") {
                if viewModel.engeller.isEmpty {
                    Text("İşaretlenmiş nokta yok")
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
                ForEach(viewModel.engeller) { engel in
                    HazardRow(
                        engel: engel,
                        duzenleyebilir: viewModel.duzenleyebilir,
                        onDurum: { durum in
                            Task { await viewModel.engelDurumDegistir(engel, durum: durum) }
                        },
                        onSil: { Task { await viewModel.engelSil(engel) } }
                    )
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(NavDestination.harita.label)
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await viewModel.load() }
        .toolbar {
            if viewModel.duzenleyebilir {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Yeni Asfalt Rotası", systemImage: "scribble") {
                            yolFormu = true
                        }
                        Button("Engel / Çukur İşaretle", systemImage: "exclamationmark.triangle") {
                            engelFormu = true
                        }
                    } label: {
                        Label("Ekle", systemImage: "plus")
                    }
                }
            }
        }
        .overlay {
            if viewModel.isLoading, viewModel.yollar.isEmpty { LoadingOverlay() }
        }
        .task {
            if viewModel.katmanVerisi == nil { await viewModel.load() }
            await lookups.loadIfNeeded()
        }
        .fullScreenCover(isPresented: $tamEkran) {
            NavigationStack {
                harita(yukseklik: nil)
                    .ignoresSafeArea(edges: .bottom)
                    .navigationTitle("Harita")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Kapat") { tamEkran = false }
                        }
                        ToolbarItem(placement: .principal) {
                            KBMapBasemapPicker(basemap: $basemap).frame(maxWidth: 220)
                        }
                    }
            }
        }
        .sheet(isPresented: $yolFormu) {
            NavigationStack {
                RoadFormView(lookups: lookups) { Task { await viewModel.load() } }
            }
        }
        .sheet(isPresented: $engelFormu) {
            NavigationStack {
                HazardFormView(merkez: viewModel.haritaMerkezi) {
                    Task { await viewModel.load() }
                }
            }
        }
        .sheet(item: $secilenYol) { yol in
            NavigationStack {
                RoadDetailSheet(
                    yol: yol,
                    lookups: lookups,
                    personelAtayabilir: viewModel.personelAtayabilir,
                    duzenleyebilir: viewModel.duzenleyebilir
                ) {
                    Task { await viewModel.load() }
                }
            }
        }
    }

    @ViewBuilder
    private func harita(yukseklik: CGFloat?) -> some View {
        KBMapView(
            polylines: viewModel.polylines,
            pins: viewModel.pins,
            basemap: basemap,
            onSelectPin: { id in viewModel.pinSecildi(id) },
            focusKey: viewModel.kadrajAnahtari
        )
        .frame(height: yukseklik)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: yukseklik == nil ? 0 : KBTheme.radiusSm))
    }

    private func yolDetay(_ yol: AsphaltRoadDTO) -> String? {
        [
            yol.dokumTarihi.map { "Döküm: \($0.kbGun)" },
            yol.personelAdlari.map { "Ekip: \($0)" },
            KBGeo.uzunlukMetni(KBGeo.uzunlukMetre(KBGeo.coordinates(yol.koordinatlar))),
        ]
        .compactMap { $0 }
        .joined(separator: " · ")
    }
}

// MARK: - Katman seçimi

/// Web panelindeki katman onay kutularının karşılığı.
enum MapLayerKind: String, CaseIterable, Identifiable {
    case yollar
    case engeller
    case sikayetler
    case araclar

    var id: String { rawValue }

    var label: String {
        switch self {
        case .yollar: return "Yollar"
        case .engeller: return "Engeller"
        case .sikayetler: return "Şikayetler"
        case .araclar: return "Araçlar"
        }
    }

    var symbolName: String {
        switch self {
        case .yollar: return "road.lanes"
        case .engeller: return "exclamationmark.triangle"
        case .sikayetler: return "phone"
        case .araclar: return "car"
        }
    }
}

private struct MapLayerToggles: View {
    @Binding var katmanlar: Set<MapLayerKind>

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(MapLayerKind.allCases) { katman in
                    let acik = katmanlar.contains(katman)
                    Button {
                        if acik { katmanlar.remove(katman) } else { katmanlar.insert(katman) }
                    } label: {
                        Label(katman.label, systemImage: katman.symbolName)
                    }
                    .buttonStyle(KBChipButtonStyle(tone: acik ? .info : .neutral))
                    .opacity(acik ? 1 : 0.55)
                    .accessibilityAddTraits(acik ? [.isSelected] : [])
                }
            }
        }
    }
}

// MARK: - Engel satırı

private struct HazardRow: View {
    let engel: RoadHazardDTO
    let duzenleyebilir: Bool
    let onDurum: (HazardStatus) -> Void
    let onSil: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            KBListRow(
                title: engel.tipi?.displayName ?? engel.tip,
                subtitle: engel.aciklama,
                detail: [engel.olusturan, engel.tarih?.kbAn]
                    .compactMap { $0 }
                    .joined(separator: " · "),
                badge: engel.durumu?.displayName ?? engel.durum,
                badgeTone: (engel.durumu?.badgeTone ?? .neutral).badge
            )

            if !engel.photoIds.isEmpty {
                HazardPhotoStrip(photoIds: engel.photoIds)
            }

            if duzenleyebilir {
                HStack(spacing: 8) {
                    if engel.durumu == .ACIK {
                        Button("Giderildi") { onDurum(.GIDERILDI) }
                            .buttonStyle(KBChipButtonStyle(tone: .success))
                    } else {
                        Button("Yeniden Aç") { onDurum(.ACIK) }
                            .buttonStyle(KBChipButtonStyle(tone: .warning))
                    }
                    Button("Sil", role: .destructive) { onSil() }
                        .buttonStyle(KBChipButtonStyle(tone: .danger))
                }
            }
        }
    }
}

/// Engel fotoğrafları oturumlu uçtan indirilir; `AsyncImage` Bearer başlığı
/// gönderemediği için görüntüler APIClient üzerinden çekilir.
struct HazardPhotoStrip: View {
    let photoIds: [String]

    @State private var gorseller: [String: UIImage] = [:]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(photoIds, id: \.self) { id in
                    Group {
                        if let image = gorseller[id] {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFill()
                        } else {
                            ProgressView()
                        }
                    }
                    .frame(width: 72, height: 72)
                    .background(KBTheme.background)
                    .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
                }
            }
        }
        .task {
            for id in photoIds where gorseller[id] == nil {
                if let dosya = try? await APIClient.shared.downloadHazardPhoto(id: id),
                   let image = UIImage(data: dosya.data) {
                    gorseller[id] = image
                }
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
final class MapScreenViewModel: ObservableObject {
    @Published private(set) var katmanVerisi: MapLayersDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var katmanlar: Set<MapLayerKind> = Set(MapLayerKind.allCases)
    /// Haritada bir pin seçildiğinde listede öne çıkarmak için tutulur.
    @Published private(set) var seciliPinId: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var yollar: [AsphaltRoadDTO] { katmanVerisi?.yollar ?? [] }
    var engeller: [RoadHazardDTO] { katmanVerisi?.engeller ?? [] }
    var sikayetler: [ComplaintPinDTO] { katmanVerisi?.sikayetler ?? [] }
    var araclar: [LiveVehicleDTO] { katmanVerisi?.araclar ?? [] }
    var duzenleyebilir: Bool { katmanVerisi?.duzenleyebilir ?? false }
    var personelAtayabilir: Bool { katmanVerisi?.personelAtayabilir ?? false }

    var ozet: [KBStat] {
        [
            KBStat(label: "Asfalt rotası", value: String(yollar.count), tone: .info),
            KBStat(
                label: "Açık engel",
                value: String(engeller.filter { $0.durumu == .ACIK }.count),
                tone: .danger
            ),
            KBStat(label: "Konumlu şikayet", value: String(sikayetler.count), tone: .accent),
            KBStat(label: "Canlı araç", value: String(araclar.count), tone: .success),
        ]
    }

    var polylines: [KBMapPolyline] {
        guard katmanlar.contains(.yollar) else { return [] }
        return yollar.map { yol in
            KBMapPolyline(
                id: yol.id,
                coordinates: KBGeo.coordinates(yol.koordinatlar),
                style: yol.durumu == .TAMAMLANDI ? .asfalt : .taslak
            )
        }
    }

    var pins: [KBMapPin] {
        var sonuc: [KBMapPin] = []
        if katmanlar.contains(.engeller) {
            sonuc += engeller.map { engel in
                KBMapPin(
                    id: "engel-\(engel.id)",
                    coordinate: KBCoordinate(lat: engel.lat, lng: engel.lng),
                    kind: .engel,
                    title: engel.tipi?.displayName ?? engel.tip,
                    subtitle: engel.aciklama
                )
            }
        }
        if katmanlar.contains(.sikayetler) {
            sonuc += sikayetler.map { sikayet in
                KBMapPin(
                    id: "sikayet-\(sikayet.id)",
                    coordinate: KBCoordinate(lat: sikayet.lat, lng: sikayet.lng),
                    kind: .sikayet,
                    title: sikayet.sikayetNo,
                    subtitle: [sikayet.durum, sikayet.aciklama]
                        .compactMap { $0 }
                        .joined(separator: " · ")
                )
            }
        }
        if katmanlar.contains(.araclar) {
            sonuc += araclar.map { arac in
                KBMapPin(
                    id: "arac-\(arac.id)",
                    coordinate: KBCoordinate(lat: arac.lat, lng: arac.lng),
                    kind: .arac,
                    title: arac.plaka,
                    subtitle: [arac.tip, arac.zaman?.kbSaat]
                        .compactMap { $0 }
                        .joined(separator: " · ")
                )
            }
        }
        return sonuc
    }

    /// Yeni engel formu haritanın ortasından başlar.
    var haritaMerkezi: KBCoordinate {
        KBGeo.merkez(
            yollar.flatMap { KBGeo.coordinates($0.koordinatlar) }
                + engeller.map { KBCoordinate(lat: $0.lat, lng: $0.lng) }
        ) ?? KBMapView.karsMerkez
    }

    /// Katman/veri değişince kadraj yeniden hesaplanır.
    var kadrajAnahtari: String {
        "\(yollar.count)-\(engeller.count)-\(sikayetler.count)-\(araclar.count)"
            + "-\(katmanlar.count)"
    }

    func pinSecildi(_ id: String) {
        seciliPinId = id
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            katmanVerisi = try await api.fetchMapLayers()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func engelDurumDegistir(_ engel: RoadHazardDTO, durum: HazardStatus) async {
        errorMessage = nil
        do {
            _ = try await api.updateHazardStatus(id: engel.id, durum: durum)
            await load()
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    func engelSil(_ engel: RoadHazardDTO) async {
        errorMessage = nil
        do {
            _ = try await api.deleteHazard(id: engel.id)
            await load()
        } catch {
            errorMessage = APIError.describe(error)
        }
    }
}
