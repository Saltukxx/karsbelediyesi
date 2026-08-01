import SwiftUI

/// Asfalt rotası çizme formu: haritaya dokunarak polyline oluşturulur,
/// web'deki Leaflet çizim aracının karşılığıdır.
struct RoadFormView: View {
    @ObservedObject var lookups: LookupStore
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = RoadFormModel()
    @State private var basemap: KBMapBasemap = .standart
    @State private var seciliNokta: Int?

    var body: some View {
        Form {
            Section("Rota çizimi") {
                KBMapView(
                    basemap: basemap,
                    draft: $form.noktalar,
                    seciliNoktaIndex: $seciliNokta,
                    focusKey: "yol-cizim"
                )
                .frame(height: 280)
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))

                KBMapBasemapPicker(basemap: $basemap)
                KBMapDrawBar(noktalar: $form.noktalar, seciliIndex: $seciliNokta)
                if let hata = form.hatalar["koordinatlar"] {
                    Text(hata).font(.caption).foregroundStyle(KBTheme.danger)
                }
            }

            Section("Rota bilgileri") {
                KBTextField(
                    title: "Yol Adı",
                    text: $form.ad,
                    required: true,
                    placeholder: "Örn. Ordu Caddesi 2. etap",
                    error: form.hatalar["ad"]
                )
                KBEnumField(title: "Durum", selection: $form.durum)
                KBDateField(title: "Döküm Tarihi", date: $form.dokumTarihi)
                KBPickerField(
                    title: "Sorumlu Müdürlük",
                    items: lookups.mudurlukler,
                    selection: $form.departmentId,
                    placeholder: "Seçilmedi",
                    label: { $0.name ?? "—" }
                )
                KBTextField(title: "Notlar", text: $form.notlar, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Rotayı Kaydet",
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
        .navigationTitle("Yeni Asfalt Rotası")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class RoadFormModel: ObservableObject {
    @Published var ad = ""
    @Published var noktalar: [KBCoordinate] = []
    @Published var durum: AsphaltStatus = .TAMAMLANDI
    @Published var dokumTarihi: Date?
    @Published var departmentId: String?
    @Published var notlar = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        var sonuc: [String: String] = [:]
        if ad.trimmingCharacters(in: .whitespaces).isEmpty { sonuc["ad"] = "Yol adı gerekli" }
        if noktalar.count < 2 { sonuc["koordinatlar"] = "En az 2 nokta işaretleyin" }
        return sonuc
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createAsphaltRoad(
                AsphaltRoadRequestDTO(
                    ad: ad.trimmingCharacters(in: .whitespaces),
                    koordinatlar: KBGeo.pairs(noktalar),
                    durum: durum.rawValue,
                    dokumTarihi: dokumTarihi?.kbIsoGun,
                    departmentId: departmentId,
                    notlar: notlar.bosDegilse
                )
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

// MARK: - Rota detayı

/// Rotaya dokununca açılan kart: durum güncelleme, müdürlük ataması,
/// personel görevlendirme ve silme.
struct RoadDetailSheet: View {
    let yol: AsphaltRoadDTO
    @ObservedObject var lookups: LookupStore
    let personelAtayabilir: Bool
    let duzenleyebilir: Bool
    var onChanged: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var model = RoadDetailModel()
    @State private var silmeOnayi = false

    var body: some View {
        Form {
            if let errorMessage = model.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            Section("Rota") {
                KBDetailRow(label: "Ad", value: yol.ad)
                KBDetailRow(label: "Durum", value: yol.durumu?.displayName ?? yol.durum)
                KBDetailRow(label: "Müdürlük", value: yol.mudurluk)
                KBDetailRow(label: "Döküm tarihi", value: yol.dokumTarihi.kbGun)
                KBDetailRow(
                    label: "Uzunluk",
                    value: KBGeo.uzunlukMetni(
                        KBGeo.uzunlukMetre(KBGeo.coordinates(yol.koordinatlar))
                    )
                )
                KBDetailRow(label: "Oluşturan", value: yol.olusturan)
                if let notlar = yol.notlar, !notlar.isEmpty {
                    KBDetailRow(label: "Not", value: notlar)
                }
            }

            Section("Rota izi") {
                KBMapView(
                    polylines: [
                        KBMapPolyline(
                            id: yol.id,
                            coordinates: KBGeo.coordinates(yol.koordinatlar),
                            style: .asfalt
                        )
                    ],
                    showsUserLocation: false,
                    focusKey: yol.id
                )
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
            }

            if duzenleyebilir {
                Section("Durum ve müdürlük") {
                    KBEnumField(title: "Durum", selection: $model.durum)
                    KBPickerField(
                        title: "Sorumlu Müdürlük",
                        items: lookups.mudurlukler,
                        selection: $model.departmentId,
                        placeholder: "Seçilmedi",
                        label: { $0.name ?? "—" }
                    )
                    Button("Değişiklikleri Kaydet") {
                        Task {
                            if await model.kaydet(yol: yol) {
                                onChanged()
                                dismiss()
                            }
                        }
                    }
                    .buttonStyle(KBPrimaryButtonStyle())
                    .disabled(model.isSaving)
                }
            }

            if personelAtayabilir {
                Section("Ekip ataması") {
                    KBMultiSelectField(
                        title: "Personel",
                        items: lookups.personeller,
                        selection: $model.personelIds,
                        emptyText: "Atanmış personel yok",
                        label: { $0.adSoyad }
                    )
                    Button("Ekibi Güncelle") {
                        Task {
                            if await model.personelAta(yol: yol) {
                                onChanged()
                                dismiss()
                            }
                        }
                    }
                    .buttonStyle(KBPrimaryButtonStyle(filled: false))
                    .disabled(model.isSaving)
                }
            }

            if duzenleyebilir {
                Section {
                    Button("Rotayı Sil", role: .destructive) { silmeOnayi = true }
                        .disabled(model.isSaving)
                }
            }
        }
        .navigationTitle(yol.ad)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .confirmationDialog(
            "Rota silinsin mi?",
            isPresented: $silmeOnayi,
            titleVisibility: .visible
        ) {
            Button("Sil", role: .destructive) {
                Task {
                    if await model.sil(yol: yol) {
                        onChanged()
                        dismiss()
                    }
                }
            }
            Button("Vazgeç", role: .cancel) {}
        }
        .task { model.hazirla(yol: yol) }
    }
}

@MainActor
final class RoadDetailModel: ObservableObject {
    @Published var durum: AsphaltStatus = .TAMAMLANDI
    @Published var departmentId: String?
    @Published var personelIds: Set<String> = []
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient
    private var hazirlandi = false

    init(api: APIClient = .shared) {
        self.api = api
    }

    func hazirla(yol: AsphaltRoadDTO) {
        guard !hazirlandi else { return }
        hazirlandi = true
        durum = yol.durumu ?? .TAMAMLANDI
        departmentId = yol.departmentId
        personelIds = Set(yol.personel.map(\.id))
    }

    func kaydet(yol: AsphaltRoadDTO) async -> Bool {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.updateAsphaltRoad(
                id: yol.id,
                body: AsphaltRoadPatchDTO(
                    durum: durum.rawValue,
                    departmentId: .some(departmentId)
                )
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }

    func personelAta(yol: AsphaltRoadDTO) async -> Bool {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.assignAsphaltPersonnel(
                id: yol.id,
                personnelIds: Array(personelIds)
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }

    func sil(yol: AsphaltRoadDTO) async -> Bool {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.deleteAsphaltRoad(id: yol.id)
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}
