import CoreLocation
import SwiftUI

/// Engel / çukur işaretleme: haritaya dokunarak veya mevcut konumu alarak
/// nokta seçilir, kameradan fotoğraf eklenir (multipart yükleme).
struct HazardFormView: View {
    let merkez: KBCoordinate
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = HazardFormModel()
    @State private var basemap: KBMapBasemap = .standart

    var body: some View {
        Form {
            Section("Konum") {
                KBMapView(
                    pins: form.nokta.map {
                        [
                            KBMapPin(
                                id: "yeni-engel",
                                coordinate: $0,
                                kind: .engel,
                                title: "Seçilen nokta"
                            )
                        ]
                    } ?? [],
                    basemap: basemap,
                    onTapCoordinate: { form.nokta = $0 },
                    focusKey: "engel-\(form.nokta == nil ? "yok" : "var")"
                )
                .frame(height: 260)
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))

                KBMapBasemapPicker(basemap: $basemap)

                HStack(spacing: 8) {
                    Button("Konumumu Kullan") { form.konumuAl() }
                        .buttonStyle(KBChipButtonStyle(tone: .info))
                    Button("Harita Merkezi") { form.nokta = merkez }
                        .buttonStyle(KBChipButtonStyle(tone: .neutral))
                }

                KBDetailRow(label: "Seçilen konum", value: form.konumMetni)
                if let hata = form.hatalar["nokta"] {
                    Text(hata).font(.caption).foregroundStyle(KBTheme.danger)
                }
            }

            Section("Kayıt") {
                KBEnumField(title: "Tip", selection: $form.tip)
                KBTextField(
                    title: "Açıklama",
                    text: $form.aciklama,
                    placeholder: "Örn. 1 m çapında çukur",
                    multiline: true
                )
                KBPhotoField(title: "Fotoğraflar", photos: $form.fotograflar)
            }

            Section {
                KBFormActions(
                    saveTitle: "Noktayı Kaydet",
                    isSaving: form.isSaving,
                    isEnabled: form.isValid,
                    errorMessage: form.errorMessage
                ) {
                    Task {
                        if await form.save() {
                            onSaved()
                            dismiss()
                        }
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Engel / Çukur")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .task { form.baslangicNoktasi(merkez) }
    }
}

@MainActor
final class HazardFormModel: NSObject, ObservableObject {
    @Published var nokta: KBCoordinate?
    @Published var tip: HazardKind = .CUKUR
    @Published var aciklama = ""
    @Published var fotograflar: [HazardPhotoUpload] = []
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient
    private let konumYoneticisi = CLLocationManager()

    init(api: APIClient = .shared) {
        self.api = api
        super.init()
        konumYoneticisi.delegate = self
    }

    var konumMetni: String {
        guard let nokta else { return "Haritaya dokunun" }
        return String(format: "%.5f, %.5f", nokta.lat, nokta.lng)
    }

    var hatalar: [String: String] {
        nokta == nil ? ["nokta": "Haritada bir nokta seçin"] : [:]
    }

    var isValid: Bool { hatalar.isEmpty }

    func baslangicNoktasi(_ merkez: KBCoordinate) {
        if nokta == nil { nokta = merkez }
    }

    /// Saha kullanıcısı çoğunlukla noktanın üzerindedir; tek dokunuşla
    /// cihaz konumu seçilir.
    func konumuAl() {
        switch konumYoneticisi.authorizationStatus {
        case .notDetermined:
            konumYoneticisi.requestWhenInUseAuthorization()
        case .denied, .restricted:
            errorMessage = "Konum izni kapalı. Ayarlardan izin verebilirsiniz."
            return
        default:
            break
        }
        konumYoneticisi.requestLocation()
    }

    func save() async -> Bool {
        guard let nokta else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createHazard(
                lat: nokta.lat,
                lng: nokta.lng,
                tip: tip,
                aciklama: aciklama.bosDegilse,
                photos: fotograflar
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

extension HazardFormModel: CLLocationManagerDelegate {
    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let konum = locations.last else { return }
        let koordinat = KBCoordinate(
            lat: konum.coordinate.latitude,
            lng: konum.coordinate.longitude
        )
        Task { @MainActor in
            self.nokta = koordinat
            self.errorMessage = nil
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        Task { @MainActor in
            self.errorMessage = "Konum alınamadı: \(error.localizedDescription)"
        }
    }
}
