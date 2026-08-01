import SwiftUI

/// `/araclar/yeni` ve araç kartındaki düzenleme formu.
struct VehicleFormView: View {
    enum Mode {
        case create
        case edit(VehicleDetailDTO)

        var isEdit: Bool {
            if case .edit = self { return true }
            return false
        }
    }

    let mode: Mode
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form: VehicleFormModel
    @ObservedObject private var lookups = LookupStore.shared

    init(mode: Mode, onSaved: @escaping () -> Void) {
        self.mode = mode
        self.onSaved = onSaved
        _form = StateObject(wrappedValue: VehicleFormModel(mode: mode))
    }

    var body: some View {
        Form {
            Section("Künye") {
                KBTextField(
                    title: "Plaka",
                    text: $form.plaka,
                    required: true,
                    placeholder: "36 AB 123",
                    capitalization: .characters,
                    error: form.hatalar["plaka"]
                )
                KBTextField(title: "Araç adı / tanımı", text: $form.ad)
                KBPickerField(
                    title: "Araç cinsi",
                    items: lookups.aracTipleri,
                    selection: $form.vehicleTypeId,
                    label: { $0.name ?? "—" }
                )
                KBTextField(title: "Marka", text: $form.marka)
                KBTextField(title: "Model", text: $form.model)
                KBNumberField(
                    title: "Model yılı",
                    text: $form.modelYili,
                    decimals: false,
                    error: form.hatalar["modelYili"]
                )
            }

            Section("Bağlantılar") {
                KBPickerField(
                    title: "Müdürlük",
                    items: lookups.mudurlukler,
                    selection: $form.departmentId,
                    label: { $0.name ?? "—" }
                )
                KBPickerField(
                    title: "Atanan şoför",
                    items: lookups.soforler,
                    selection: $form.atananSoforId,
                    label: { $0.name ?? "—" }
                )
            }

            Section("Teknik") {
                KBEnumField(title: "Yakıt tipi", selection: $form.yakitTipi)
                KBTextField(title: "Kapasite", text: $form.kapasite)
                KBEnumField(title: "Sayaç birimi", selection: $form.sayacBirim)
                KBNumberField(
                    title: "Sayaç değeri",
                    text: $form.sayacDeger,
                    suffix: form.sayacBirim == .SAAT ? "saat" : "km",
                    error: form.hatalar["sayacDeger"]
                )
                KBNumberField(
                    title: "Norm tüketim",
                    text: $form.normTuketim,
                    suffix: form.sayacBirim == .SAAT ? "lt/saat" : "lt/100km",
                    error: form.hatalar["normTuketim"]
                )
                KBTextField(title: "Bakım km / saat aralığı", text: $form.bakimKmSaati)
            }

            Section("Durum") {
                KBEnumField(title: "Envanter durumu", selection: $form.envanterDurumu)
                KBEnumField(title: "Operasyon durumu", selection: $form.operasyonDurumu)
            }

            Section("Takvim") {
                KBDateField(title: "Muayene tarihi", date: $form.muayeneTarihi)
                KBDateField(title: "Sigorta bitişi", date: $form.sigortaBitis)
                KBDateField(title: "Son bakım", date: $form.sonBakimTarihi)
                KBDateField(title: "Sonraki bakım", date: $form.sonrakiBakimTarihi)
            }

            Section("Notlar") {
                KBTextField(title: "Notlar", text: $form.notlar, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: mode.isEdit ? "Değişiklikleri Kaydet" : "Aracı Kaydet",
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
        .navigationTitle(mode.isEdit ? "Aracı Düzenle" : "Yeni Araç")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Kapat") { dismiss() }
            }
        }
        .task { await lookups.loadIfNeeded() }
    }
}

@MainActor
final class VehicleFormModel: ObservableObject {
    @Published var plaka = ""
    @Published var ad = ""
    @Published var vehicleTypeId: String?
    @Published var marka = ""
    @Published var model = ""
    @Published var modelYili = ""
    @Published var departmentId: String?
    @Published var atananSoforId: String?
    @Published var yakitTipi: VehicleFuelType = .DIZEL
    @Published var kapasite = ""
    @Published var sayacBirim: MeterUnit = .KM
    @Published var sayacDeger = ""
    @Published var normTuketim = ""
    @Published var bakimKmSaati = ""
    @Published var envanterDurumu: VehicleInventoryStatus = .AKTIF
    @Published var operasyonDurumu: VehicleOperationStatus = .MUSAIT
    @Published var muayeneTarihi: Date?
    @Published var sigortaBitis: Date?
    @Published var sonBakimTarihi: Date?
    @Published var sonrakiBakimTarihi: Date?
    @Published var notlar = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient
    private let duzenlenenId: String?

    init(mode: VehicleFormView.Mode, api: APIClient = .shared) {
        self.api = api
        guard case let .edit(arac) = mode else {
            duzenlenenId = nil
            return
        }
        duzenlenenId = arac.id
        plaka = arac.plaka
        ad = arac.ad ?? ""
        vehicleTypeId = arac.vehicleTypeId
        marka = arac.marka ?? ""
        model = arac.model ?? ""
        modelYili = arac.modelYili.map(String.init) ?? ""
        departmentId = arac.departmentId
        atananSoforId = arac.atananSoforId
        yakitTipi = arac.yakitTipi.flatMap(VehicleFuelType.init(rawValue:)) ?? .DIZEL
        kapasite = arac.kapasite ?? ""
        sayacBirim = arac.sayacBirim.flatMap(MeterUnit.init(rawValue:)) ?? .KM
        sayacDeger = KBNumberFormat.text(arac.sayacDeger)
        normTuketim = KBNumberFormat.text(arac.normTuketim)
        bakimKmSaati = arac.bakimKmSaati ?? ""
        envanterDurumu = VehicleInventoryStatus(rawValue: arac.envanterDurumu) ?? .AKTIF
        operasyonDurumu = VehicleOperationStatus(rawValue: arac.operasyonDurumu) ?? .MUSAIT
        muayeneTarihi = arac.muayeneTarihi
        sigortaBitis = arac.sigortaBitis
        sonBakimTarihi = arac.sonBakimTarihi
        sonrakiBakimTarihi = arac.sonrakiBakimTarihi
        notlar = arac.notlar ?? ""
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if plaka.trimmingCharacters(in: .whitespaces).isEmpty {
            result["plaka"] = "Plaka zorunlu"
        }
        for (key, value) in [
            ("modelYili", modelYili),
            ("sayacDeger", sayacDeger),
            ("normTuketim", normTuketim),
        ] where KBNumberFormat.isInvalid(value) {
            result[key] = "Geçerli bir sayı girin"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let body = VehicleRequestDTO(
            plaka: plaka.trimmingCharacters(in: .whitespaces).uppercased(),
            ad: ad.bosDegilse,
            vehicleTypeId: vehicleTypeId,
            marka: marka.bosDegilse,
            model: model.bosDegilse,
            modelYili: KBNumberFormat.parseInt(modelYili),
            yakitTipi: yakitTipi.rawValue,
            kapasite: kapasite.bosDegilse,
            sayacDeger: KBNumberFormat.parse(sayacDeger),
            sayacBirim: sayacBirim.rawValue,
            normTuketim: KBNumberFormat.parse(normTuketim),
            muayeneTarihi: muayeneTarihi?.kbIsoGun,
            sigortaBitis: sigortaBitis?.kbIsoGun,
            sonBakimTarihi: sonBakimTarihi?.kbIsoGun,
            sonrakiBakimTarihi: sonrakiBakimTarihi?.kbIsoGun,
            bakimKmSaati: bakimKmSaati.bosDegilse,
            departmentId: departmentId,
            atananSoforId: atananSoforId,
            envanterDurumu: envanterDurumu.rawValue,
            operasyonDurumu: operasyonDurumu.rawValue,
            notlar: notlar.bosDegilse
        )

        do {
            if let duzenlenenId {
                _ = try await api.updateVehicle(id: duzenlenenId, body: body)
            } else {
                _ = try await api.createVehicle(body)
            }
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

extension String {
    /// Boş/boşluk metinler sunucuya gönderilmez; opsiyonel alanlar `nil` kalır.
    var bosDegilse: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
