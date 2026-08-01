import SwiftUI

/// `/gorevler` — görev listesi, tam oluşturma formu ve dispatch rotası olan
/// görevler için harita kısayolu.
struct TasksView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var viewModel = TasksViewModel()
    @ObservedObject private var lookups = LookupStore.shared
    @State private var formGosteriliyor = false
    @State private var haritadakiGorev: VehicleTaskDTO?

    var body: some View {
        KBModuleScreen(
            title: NavDestination.gorevler.label,
            icon: NavDestination.gorevler.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.gorevler.isEmpty,
            emptyMessage: "Görev kaydı yok. Sağ üstten yeni görev oluşturabilirsiniz.",
            searchText: $viewModel.arama,
            searchPrompt: "Görev no, plaka veya açıklama",
            newItemLabel: session.canCreateTask ? "Yeni Görev" : nil,
            onNewItem: session.canCreateTask ? { formGosteriliyor = true } : nil,
            onRefresh: { await viewModel.load() }
        ) {
            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
            }

            Section("Görevler (\(viewModel.gorevler.count))") {
                ForEach(viewModel.gorevler) { gorev in
                    VStack(alignment: .leading, spacing: 8) {
                        NavigationLink(value: PanelRoute.task(gorev.id)) {
                            KBListRow(
                                title: gorev.gorevNo ?? "Görev",
                                subtitle: gorev.vehicle?.plaka,
                                detail: gorevDetay(gorev),
                                badge: gorev.durumu?.displayName ?? gorev.durum,
                                badgeTone: (gorev.durumu?.badgeTone ?? .neutral).badge
                            )
                        }

                        if gorev.rotaVarMi {
                            Button("Rotayı Haritada Gör") { haritadakiGorev = gorev }
                                .buttonStyle(KBChipButtonStyle(tone: .info))
                        }
                    }
                }
            }
        }
        .task {
            if viewModel.gorevler.isEmpty { await viewModel.load() }
            await lookups.loadIfNeeded()
        }
        .sheet(isPresented: $formGosteriliyor) {
            NavigationStack {
                TaskCreateView(lookups: lookups) { Task { await viewModel.load() } }
            }
        }
        .sheet(item: $haritadakiGorev) { gorev in
            TaskRouteMapView(task: gorev)
        }
    }

    private func gorevDetay(_ gorev: VehicleTaskDTO) -> String? {
        [
            gorev.aciklama,
            gorev.baslangicTarihi.map { "Çıkış: \($0.kbAn)" },
            gorev.bitisTarihi.map { "Giriş: \($0.kbAn)" },
        ]
            .compactMap { $0 }
            .joined(separator: " · ")
    }
}

@MainActor
final class TasksViewModel: ObservableObject {
    @Published private(set) var tumu: [VehicleTaskDTO] = []
    @Published private(set) var isLoading = false
    @Published var arama = ""
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var gorevler: [VehicleTaskDTO] {
        let terim = arama.trimmingCharacters(in: .whitespaces)
        guard !terim.isEmpty else { return tumu }
        return tumu.filter {
            ($0.gorevNo ?? "").localizedCaseInsensitiveContains(terim)
                || ($0.vehicle?.plaka ?? "").localizedCaseInsensitiveContains(terim)
                || ($0.aciklama ?? "").localizedCaseInsensitiveContains(terim)
        }
    }

    var ozet: [KBStat] {
        func sayi(_ durum: TaskStatus) -> String {
            String(tumu.filter { $0.durum == durum.rawValue }.count)
        }
        return [
            KBStat(label: "Planlandı", value: sayi(.PLANLANDI), tone: .info),
            KBStat(label: "Devam eden", value: sayi(.DEVAM_EDIYOR), tone: .warning),
            KBStat(label: "Tamamlandı", value: sayi(.TAMAMLANDI), tone: .success),
        ]
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            tumu = try await api.fetchTasks()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }
}

// MARK: - Oluşturma formu

/// Web `/gorevler` sayfasındaki formun tam alan seti.
struct TaskCreateView: View {
    @ObservedObject var lookups: LookupStore
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var form = TaskCreateFormModel()

    var body: some View {
        Form {
            Section("Araç ve talep") {
                KBPickerField(
                    title: "Araç",
                    items: lookups.araclar,
                    selection: $form.vehicleId,
                    required: true,
                    placeholder: "Araç seçin",
                    error: form.hatalar["vehicleId"],
                    label: \.etiket
                )
                KBPickerField(
                    title: "Talep Eden Müdürlük",
                    items: lookups.mudurlukler,
                    selection: $form.talepEdenDepartmentId,
                    placeholder: "Seçilmedi",
                    label: { $0.name ?? "—" }
                )
                KBPickerField(
                    title: "Şoför",
                    items: lookups.soforler,
                    selection: $form.driverId,
                    placeholder: "Zimmetli şoför",
                    label: { $0.name ?? "—" }
                )
            }

            Section("Görev") {
                KBTextField(
                    title: "Görev Yeri",
                    text: $form.gorevYeri,
                    placeholder: "Mahalle / cadde"
                )
                KBTextField(
                    title: "Görev Tanımı",
                    text: $form.gorevTanimi,
                    multiline: true
                )
                KBEnumField(title: "Durum", selection: $form.durum)
            }

            Section("Zaman ve KM") {
                KBDateField(
                    title: "Çıkış Tarihi",
                    date: $form.cikisTarihi,
                    components: [.date, .hourAndMinute]
                )
                KBDateField(
                    title: "Giriş Tarihi",
                    date: $form.girisTarihi,
                    components: [.date, .hourAndMinute]
                )
                KBNumberField(
                    title: "KM Sayaç (Çıkış)",
                    text: $form.kmSayacCikis,
                    suffix: "km"
                )
                KBNumberField(
                    title: "KM Sayaç (Giriş)",
                    text: $form.kmSayacGiris,
                    suffix: "km",
                    error: form.hatalar["kmSayacGiris"]
                )
            }

            Section("Onay ve maliyet") {
                KBPickerField(
                    title: "Onaylayan",
                    items: lookups.onaylayanlar,
                    selection: $form.onaylayanId,
                    placeholder: "Seçilmedi",
                    label: { $0.name ?? "—" }
                )
                KBNumberField(title: "Maliyet", text: $form.maliyet, suffix: "₺")
                KBTextField(title: "Not", text: $form.not, multiline: true)
            }

            Section {
                KBFormActions(
                    saveTitle: "Görevi Kaydet",
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
        .navigationTitle("Yeni Görev")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class TaskCreateFormModel: ObservableObject {
    @Published var vehicleId: String?
    @Published var talepEdenDepartmentId: String?
    @Published var driverId: String?
    @Published var gorevYeri = ""
    @Published var gorevTanimi = ""
    @Published var durum: TaskStatus = .PLANLANDI
    @Published var cikisTarihi: Date?
    @Published var girisTarihi: Date?
    @Published var kmSayacCikis = ""
    @Published var kmSayacGiris = ""
    @Published var onaylayanId: String?
    @Published var maliyet = ""
    @Published var not = ""

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var hatalar: [String: String] {
        var result: [String: String] = [:]
        if vehicleId == nil { result["vehicleId"] = "Araç seçin" }
        // Sunucudaki validateKmPair ile aynı kural
        if let cikis = KBNumberFormat.parse(kmSayacCikis),
           let giris = KBNumberFormat.parse(kmSayacGiris),
           giris < cikis {
            result["kmSayacGiris"] = "Giriş KM, çıkış KM'den küçük olamaz"
        }
        return result
    }

    var isValid: Bool { hatalar.isEmpty }

    func save() async -> Bool {
        guard let vehicleId, isValid else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.createTask(
                TaskCreateRequestDTO(
                    vehicleId: vehicleId,
                    talepEdenDepartmentId: talepEdenDepartmentId,
                    driverId: driverId,
                    gorevYeri: gorevYeri.bosDegilse,
                    gorevTanimi: gorevTanimi.bosDegilse,
                    cikisTarihi: cikisTarihi?.kbIsoAn,
                    girisTarihi: girisTarihi?.kbIsoAn,
                    kmSayacCikis: KBNumberFormat.parse(kmSayacCikis),
                    kmSayacGiris: KBNumberFormat.parse(kmSayacGiris),
                    onaylayanId: onaylayanId,
                    durum: durum.rawValue,
                    not: not.bosDegilse,
                    maliyet: KBNumberFormat.parse(maliyet)
                )
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

extension VehicleTaskDTO {
    var durumu: TaskStatus? { durum.flatMap(TaskStatus.init(rawValue:)) }

    /// Dispatch rotası olan görevler haritada gösterilebilir.
    var rotaVarMi: Bool {
        (rota?.gidis?.isEmpty == false) || (rota?.servis?.isEmpty == false)
    }
}

extension AppSession {
    /// Web `gorevOlustur`: ADMIN, DEPARTMENT_MANAGER, APPROVER.
    var canCreateTask: Bool {
        role == .ADMIN || role == .DEPARTMENT_MANAGER || role == .APPROVER
    }
}
