import SwiftUI

/// `/kontrol-listeleri` — şablon kartları, yeni form başlatma ve doldurulan
/// formların listesi.
struct ChecklistsView: View {
    @StateObject private var viewModel = ChecklistsViewModel()
    @ObservedObject private var queue = ChecklistOfflineQueue.shared
    @State private var formGosteriliyor = false

    var body: some View {
        KBModuleScreen(
            title: NavDestination.kontrol.label,
            icon: NavDestination.kontrol.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.data == nil,
            emptyMessage: "Kontrol formu yok. Sağ üstten yeni form başlatabilirsiniz.",
            searchText: $viewModel.arama,
            searchPrompt: "Şablon veya plaka ara",
            newItemLabel: "Yeni Form",
            onNewItem: { formGosteriliyor = true },
            onRefresh: { await viewModel.load() }
        ) {
            if !queue.pending.isEmpty {
                Section {
                    ChecklistQueueBanner()
                }
            }

            Section {
                Text(
                    "\(viewModel.sablonlar.count) makine şablonu · hafta 1–4 + aylık bakım. "
                        + "Arızalı kalemler otomatik bakım kaydı açar."
                )
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
            }

            if !viewModel.sablonlar.isEmpty {
                Section("Şablonlar") {
                    ForEach(viewModel.sablonlar) { sablon in
                        KBListRow(
                            title: sablon.ekipmanAdi,
                            subtitle: sablon.aciklama,
                            trailingValue: "\(sablon.kalemSayisi) kalem"
                        )
                    }
                }
            }

            Section("Doldurulan Formlar (\(viewModel.formlar.count))") {
                if viewModel.formlar.isEmpty {
                    Text("Henüz form yok.")
                        .font(.subheadline)
                        .foregroundStyle(KBTheme.muted)
                } else {
                    ForEach(viewModel.formlar) { form in
                        NavigationLink(value: PanelRoute.checklist(form.id)) {
                            KBListRow(
                                title: form.sablonAdi,
                                subtitle: "\(form.plaka) · \(form.donem)",
                                detail: formDetay(form),
                                badge: form.durumu?.displayName ?? form.durum,
                                badgeTone: (form.durumu?.badgeTone ?? .neutral).badge,
                                trailingValue: "\(form.doldurulanKalem) kalem"
                            )
                        }
                    }
                }
            }
        }
        .task {
            if viewModel.data == nil { await viewModel.load() }
            if await queue.flush() > 0 { await viewModel.load() }
        }
        .sheet(isPresented: $formGosteriliyor) {
            NavigationStack {
                ChecklistCreateView(
                    sablonlar: viewModel.sablonlar,
                    araclar: viewModel.araclar
                ) { _ in Task { await viewModel.load() } }
            }
        }
    }

    private func formDetay(_ form: ChecklistSummaryDTO) -> String? {
        [form.santiyeLokasyon, form.operatorAdi, form.onayTarihi?.kbGun]
            .compactMap { $0 }
            .joined(separator: " · ")
    }
}

/// Kuyrukta bekleyen kalemler her kontrol ekranında görünür.
struct ChecklistQueueBanner: View {
    @ObservedObject private var queue = ChecklistOfflineQueue.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(
                "\(queue.pending.count) kalem çevrimdışı kuyrukta bekliyor",
                systemImage: "arrow.triangle.2.circlepath"
            )
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(KBTheme.warning)

            if let lastError = queue.lastError {
                Text(lastError)
                    .font(.caption)
                    .foregroundStyle(KBTheme.danger)
            }

            Button {
                Task { await queue.flush() }
            } label: {
                if queue.isFlushing {
                    ProgressView()
                } else {
                    Text("Şimdi gönder")
                }
            }
            .buttonStyle(KBChipButtonStyle(tone: .warning))
            .disabled(queue.isFlushing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

@MainActor
final class ChecklistsViewModel: ObservableObject {
    @Published private(set) var data: ChecklistOverviewDTO?
    @Published private(set) var isLoading = false
    @Published var arama = ""
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var sablonlar: [ChecklistTemplateDTO] { data?.sablonlar ?? [] }
    var araclar: [VehicleRefDTO] { data?.araclar ?? [] }

    var formlar: [ChecklistSummaryDTO] {
        let tumu = data?.formlar ?? []
        let terim = arama.trimmingCharacters(in: .whitespaces)
        guard !terim.isEmpty else { return tumu }
        return tumu.filter {
            $0.sablonAdi.localizedCaseInsensitiveContains(terim)
                || $0.plaka.localizedCaseInsensitiveContains(terim)
        }
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            data = try await api.fetchChecklistOverview()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }
}

// MARK: - Yeni form

struct ChecklistCreateView: View {
    let sablonlar: [ChecklistTemplateDTO]
    let araclar: [VehicleRefDTO]
    var onSaved: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = ChecklistCreateFormModel()

    var body: some View {
        Form {
            Section("Şablon ve araç") {
                KBPickerField(
                    title: "Şablon",
                    items: sablonlar,
                    selection: $form.templateId,
                    required: true,
                    placeholder: "Şablon seçin",
                    error: form.hatalar["templateId"],
                    label: { "\($0.ekipmanAdi) (\($0.kalemSayisi) kalem)" }
                )
                KBPickerField(
                    title: "Araç / Plaka",
                    items: araclar,
                    selection: $form.vehicleId,
                    required: true,
                    placeholder: "Araç seçin",
                    error: form.hatalar["vehicleId"],
                    label: \.etiket
                )
            }

            Section("Dönem") {
                KBNumberField(
                    title: "Ay",
                    text: $form.ay,
                    required: true,
                    decimals: false,
                    error: form.hatalar["ay"]
                )
                KBNumberField(
                    title: "Yıl",
                    text: $form.yilDonem,
                    required: true,
                    decimals: false,
                    error: form.hatalar["yilDonem"]
                )
            }

            Section("Sorumluluk") {
                KBTextField(title: "Şantiye / Lokasyon", text: $form.santiyeLokasyon)
                KBTextField(
                    title: "Sorumlu operatör / teknisyen",
                    text: $form.sorumluOperatorTeknisyen
                )
            }

            Section {
                KBFormActions(
                    saveTitle: "Form Oluştur",
                    isSaving: form.isSaving,
                    isEnabled: form.isValid,
                    errorMessage: form.errorMessage
                ) {
                    Task {
                        if let id = await form.save() {
                            onSaved(id)
                            dismiss()
                        }
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Yeni Kontrol Formu")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class ChecklistCreateFormModel: ObservableObject {
    @Published var templateId: String?
    @Published var vehicleId: String?
    @Published var ay: String
    @Published var yilDonem: String
    @Published var santiyeLokasyon = ""
    @Published var sorumluOperatorTeknisyen = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared, now: Date = Date()) {
        self.api = api
        let parcalar = Calendar.current.dateComponents([.month, .year], from: now)
        ay = String(parcalar.month ?? 1)
        yilDonem = String(parcalar.year ?? 2026)
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if templateId == nil { result["templateId"] = "Şablon seçin" }
        if vehicleId == nil { result["vehicleId"] = "Araç seçin" }
        if let deger = KBNumberFormat.parseInt(ay), (1...12).contains(deger) {
            // geçerli
        } else {
            result["ay"] = "1–12 arası bir ay girin"
        }
        if let deger = KBNumberFormat.parseInt(yilDonem), (2000...2100).contains(deger) {
            // geçerli
        } else {
            result["yilDonem"] = "2000–2100 arası bir yıl girin"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> String? {
        guard
            let templateId,
            let vehicleId,
            let ayDegeri = KBNumberFormat.parseInt(ay),
            let yilDegeri = KBNumberFormat.parseInt(yilDonem),
            isValid
        else { return nil }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let created = try await api.createChecklist(
                ChecklistCreateRequestDTO(
                    templateId: templateId,
                    vehicleId: vehicleId,
                    ay: ayDegeri,
                    yilDonem: yilDegeri,
                    sorumluOperatorTeknisyen: sorumluOperatorTeknisyen.bosDegilse,
                    santiyeLokasyon: santiyeLokasyon.bosDegilse
                )
            )
            return created.id
        } catch {
            errorMessage = APIError.describe(error)
            return nil
        }
    }
}
