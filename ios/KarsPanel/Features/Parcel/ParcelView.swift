import SwiftUI

/// `/parsel` — TKGM parsel sorgusu. İki yol var: ada/parsel numarasıyla
/// arama ve haritaya dokunarak koordinattan sorgulama.
struct ParcelView: View {
    @StateObject private var viewModel = ParcelViewModel()
    @State private var basemap: KBMapBasemap = .standart

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            Section("Ada / parsel sorgusu") {
                KBPickerField(
                    title: "İlçe",
                    items: viewModel.ilceler,
                    selection: $viewModel.ilceId,
                    placeholder: viewModel.ilceler.isEmpty ? "Yükleniyor…" : "İlçe seçin",
                    label: \.ad
                )
                KBPickerField(
                    title: "Mahalle",
                    items: viewModel.mahalleler,
                    selection: $viewModel.mahalleId,
                    placeholder: viewModel.mahalleler.isEmpty
                        ? "Önce ilçe seçin"
                        : "Mahalle seçin",
                    label: \.ad
                )
                HStack(spacing: 12) {
                    KBNumberField(title: "Ada", text: $viewModel.ada, decimals: false)
                    KBNumberField(
                        title: "Parsel",
                        text: $viewModel.parsel,
                        required: true,
                        decimals: false
                    )
                }
                Button("Parseli Sorgula") { Task { await viewModel.adaParselSorgula() } }
                    .buttonStyle(KBPrimaryButtonStyle())
                    .disabled(!viewModel.sorgulanabilir || viewModel.isLoading)
            }

            Section("Harita") {
                KBMapBasemapPicker(basemap: $basemap)
                KBMapView(
                    polylines: viewModel.polylines,
                    pins: viewModel.pins,
                    basemap: basemap,
                    onTapCoordinate: { koordinat in
                        Task { await viewModel.koordinattanSorgula(koordinat) }
                    },
                    focusKey: viewModel.parsel_?.id ?? "bos"
                )
                .frame(height: 300)
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))

                Text("Haritada bir noktaya dokunarak o noktadaki parseli sorgulayın.")
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }

            if let parsel = viewModel.parsel_ {
                Section("Parsel bilgileri") {
                    KBDetailRow(label: "Ada / Parsel", value: parsel.baslik)
                    KBDetailRow(label: "Konum", value: parsel.konum)
                    KBDetailRow(label: "Alan", value: KBNumberFormat.miktar(parsel.alan, birim: "m²"))
                    KBDetailRow(label: "Nitelik", value: parsel.nitelik)
                    KBDetailRow(label: "Mevkii", value: parsel.mevkii)
                    KBDetailRow(label: "Pafta", value: parsel.pafta)
                    KBDetailRow(
                        label: "Kaynak",
                        value: parsel.tazeMi ? "TKGM (canlı)" : "Yerel kopya"
                    )
                    KBDetailRow(label: "Sorgu zamanı", value: parsel.sorgulandi.kbAn)
                    Button("TKGM'den Yenile") { Task { await viewModel.yenile() } }
                        .buttonStyle(KBPrimaryButtonStyle(filled: false))
                        .disabled(viewModel.isLoading)
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(NavDestination.parsel.label)
        .navigationBarTitleDisplayMode(.large)
        .overlay { if viewModel.isLoading { LoadingOverlay() } }
        .task { await viewModel.ilceleriYukle() }
        .onChange(of: viewModel.ilceId) { _, yeni in
            Task { await viewModel.mahalleleriYukle(ilceId: yeni) }
        }
    }
}

@MainActor
final class ParcelViewModel: ObservableObject {
    @Published private(set) var ilceler: [ParcelOptionDTO] = []
    @Published private(set) var mahalleler: [ParcelOptionDTO] = []
    @Published var ilceId: Int?
    @Published var mahalleId: Int?
    @Published var ada = ""
    @Published var parsel = ""
    @Published private(set) var parsel_: ParcelDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient
    /// Yenileme, son sorgunun türünü tekrarlar.
    private var sonSorgu: ParcelQuery?

    init(api: APIClient = .shared) {
        self.api = api
    }

    private enum ParcelQuery {
        case adaParsel(mahalleId: Int, ada: String, parsel: String)
        case koordinat(KBCoordinate)
    }

    var sorgulanabilir: Bool {
        mahalleId != nil && !parsel.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var polylines: [KBMapPolyline] {
        guard let parsel_ else { return [] }
        return parsel_.geometri.halkalar.enumerated().compactMap { index, halka in
            let koordinatlar = KBGeo.fromGeoJSON(halka)
            guard koordinatlar.count >= 2 else { return nil }
            return KBMapPolyline(
                id: "parsel-\(index)",
                coordinates: koordinatlar,
                style: .parsel,
                kapali: true
            )
        }
    }

    var pins: [KBMapPin] {
        guard let parsel_ else { return [] }
        return [
            KBMapPin(
                id: parsel_.id,
                coordinate: KBCoordinate(lat: parsel_.lat, lng: parsel_.lng),
                kind: .parselMerkez,
                title: parsel_.baslik,
                subtitle: parsel_.konum
            )
        ]
    }

    func ilceleriYukle() async {
        guard ilceler.isEmpty else { return }
        await calistir { self.ilceler = try await self.api.fetchParcelDistricts() }
    }

    func mahalleleriYukle(ilceId: Int?) async {
        mahalleler = []
        mahalleId = nil
        guard let ilceId else { return }
        await calistir {
            self.mahalleler = try await self.api.fetchParcelNeighborhoods(ilceId: ilceId)
        }
    }

    func adaParselSorgula() async {
        guard let mahalleId else { return }
        let adaNo = ada.trimmingCharacters(in: .whitespaces)
        let parselNo = parsel.trimmingCharacters(in: .whitespaces)
        sonSorgu = .adaParsel(mahalleId: mahalleId, ada: adaNo, parsel: parselNo)
        await sorgula(yenile: false)
    }

    func koordinattanSorgula(_ koordinat: KBCoordinate) async {
        sonSorgu = .koordinat(koordinat)
        await sorgula(yenile: false)
    }

    func yenile() async {
        await sorgula(yenile: true)
    }

    private func sorgula(yenile: Bool) async {
        guard let sonSorgu else { return }
        await calistir {
            switch sonSorgu {
            case let .adaParsel(mahalleId, ada, parsel):
                self.parsel_ = try await self.api.fetchParcel(
                    mahalleId: mahalleId,
                    ada: ada,
                    parsel: parsel,
                    yenile: yenile
                )
            case let .koordinat(koordinat):
                self.parsel_ = try await self.api.fetchParcel(
                    lat: koordinat.lat,
                    lng: koordinat.lng,
                    yenile: yenile
                )
            }
        }
    }

    private func calistir(_ islem: @escaping () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        do {
            try await islem()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }
}
