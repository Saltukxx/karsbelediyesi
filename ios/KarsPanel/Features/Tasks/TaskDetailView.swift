import SwiftUI

/// `/gorevler/[id]` — görev künyesi, başlat/kapat aksiyonları ve takip raporu
/// kısayolu.
struct TaskDetailView: View {
    let taskId: String

    @StateObject private var viewModel: TaskDetailViewModel
    @State private var kapatmaGosteriliyor = false

    init(taskId: String, api: APIClient = .shared) {
        self.taskId = taskId
        _viewModel = StateObject(wrappedValue: TaskDetailViewModel(taskId: taskId, api: api))
    }

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if let gorev = viewModel.gorev {
                Section {
                    HStack(spacing: 8) {
                        StatusBadge(
                            text: gorev.durumu?.displayName ?? gorev.durum,
                            tone: (gorev.durumu?.badgeTone ?? .neutral).badge
                        )
                        if let dispatch = gorev.dispatch {
                            StatusBadge(
                                text: TrackReportLabels.dispatchTipi(dispatch.tip),
                                tone: .accent
                            )
                        }
                        Spacer(minLength: 0)
                    }
                }

                Section("Görev") {
                    KBDetailRow(label: "Görev No", value: gorev.gorevNo)
                    KBDetailRow(label: "Talep Tarihi", value: gorev.talepTarihi.kbAn)
                    KBDetailRow(label: "Görev Yeri", value: gorev.gorevYeri)
                    KBDetailRow(label: "Görev Tanımı", value: gorev.gorevTanimi)
                    KBDetailRow(label: "Talep Eden", value: gorev.talepEdenMudurluk)
                    KBDetailRow(label: "Onaylayan", value: gorev.onaylayan)
                    if let dispatch = gorev.dispatch {
                        KBDetailRow(label: "Rota", value: dispatch.routeAd)
                    }
                }

                Section("Araç ve Şoför") {
                    KBDetailRow(label: "Plaka", value: gorev.vehicle.plaka)
                    KBDetailRow(label: "Araç", value: gorev.vehicle.ad)
                    KBDetailRow(label: "Cins", value: gorev.vehicle.tip)
                    KBDetailRow(label: "Şoför", value: gorev.sofor?.ad)
                    if let telefon = gorev.sofor?.telefon, !telefon.isEmpty {
                        KBPhoneRow(telefon: telefon)
                    }
                }

                Section("Zaman ve KM") {
                    KBDetailRow(label: "Çıkış", value: gorev.cikisTarihi.kbAn)
                    KBDetailRow(label: "Giriş", value: gorev.girisTarihi.kbAn)
                    KBDetailRow(
                        label: "Süre",
                        value: KBDurationFormat.saat(gorev.sureSaat)
                    )
                    KBDetailRow(
                        label: "KM Çıkış",
                        value: KBNumberFormat.miktar(gorev.kmSayacCikis, birim: "km")
                    )
                    KBDetailRow(
                        label: "KM Giriş",
                        value: KBNumberFormat.miktar(gorev.kmSayacGiris, birim: "km")
                    )
                    KBDetailRow(
                        label: "KM Farkı",
                        value: KBNumberFormat.miktar(gorev.kmFarki, birim: "km")
                    )
                    KBDetailRow(
                        label: "Maliyet",
                        value: KBNumberFormat.para(gorev.maliyet)
                    )
                }

                if let not = gorev.not, !not.isEmpty {
                    Section("Not") {
                        Text(not).font(.subheadline).foregroundStyle(KBTheme.navy)
                    }
                }

                if gorev.dispatch != nil {
                    Section("Rota Takibi") {
                        if let ozet = gorev.takipOzeti {
                            let sonuc = TrackReportLabels.sonuc(ozet.sonuc)
                            HStack {
                                StatusBadge(text: sonuc.label, tone: sonuc.tone.badge)
                                Spacer(minLength: 0)
                                Text(
                                    "Uyum \(KBNumberFormat.yuzde(ozet.uyumYuzde)) · "
                                        + "Kapsama \(KBNumberFormat.yuzde(ozet.kapsamaYuzde))"
                                )
                                .font(.caption)
                                .foregroundStyle(KBTheme.muted)
                            }
                        }
                        NavigationLink(value: PanelRoute.taskTrack(gorev.id)) {
                            Label("Takip Raporunu Aç", systemImage: "map")
                        }
                    }
                }

                if let durum = gorev.durumu, durum.baslatilabilir || durum.kapatilabilir {
                    Section("İşlemler") {
                        if durum.baslatilabilir {
                            TaskStartRow(isSaving: viewModel.isSaving) { km in
                                await viewModel.baslat(kmSayacCikis: km)
                            }
                        }
                        if durum.kapatilabilir {
                            Button("Görevi Kapat") { kapatmaGosteriliyor = true }
                                .buttonStyle(KBPrimaryButtonStyle(filled: false))
                                .disabled(viewModel.isSaving)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(viewModel.gorev?.gorevNo ?? "Görev")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await viewModel.load() }
        .task { if viewModel.gorev == nil { await viewModel.load() } }
        .sheet(isPresented: $kapatmaGosteriliyor) {
            NavigationStack {
                TaskCloseView(kmSayacCikis: viewModel.gorev?.kmSayacCikis) { istek in
                    await viewModel.kapat(istek)
                }
            }
        }
        .overlay {
            if viewModel.isLoading, viewModel.gorev == nil { LoadingOverlay() }
        }
    }
}

/// Başlatma satırı: KM sayacı opsiyoneldir, boş bırakılırsa sunucu mevcut
/// değeri korur.
private struct TaskStartRow: View {
    let isSaving: Bool
    let onStart: (Double?) async -> Void

    @State private var kmSayacCikis = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            KBNumberField(
                title: "KM Sayaç (Çıkış)",
                text: $kmSayacCikis,
                suffix: "km"
            )
            Button("Görevi Başlat") {
                Task { await onStart(KBNumberFormat.parse(kmSayacCikis)) }
            }
            .buttonStyle(KBPrimaryButtonStyle())
            .disabled(isSaving)
        }
    }
}

private struct TaskCloseView: View {
    let kmSayacCikis: Double?
    let onClose: (TaskCloseRequestDTO) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var girisTarihi: Date? = Date()
    @State private var kmSayacGiris = ""
    @State private var durum: TaskClosingStatus = .TAMAMLANDI
    @State private var isSaving = false

    private var kmHatasi: String? {
        guard
            let cikis = kmSayacCikis,
            let giris = KBNumberFormat.parse(kmSayacGiris),
            giris < cikis
        else { return nil }
        return "Giriş KM, çıkış KM'den (\(KBNumberFormat.miktar(cikis))) küçük olamaz"
    }

    var body: some View {
        Form {
            Section("Kapanış") {
                KBDateField(
                    title: "Giriş Tarihi",
                    date: $girisTarihi,
                    components: [.date, .hourAndMinute]
                )
                KBNumberField(
                    title: "KM Sayaç (Giriş)",
                    text: $kmSayacGiris,
                    suffix: "km",
                    error: kmHatasi
                )
                KBEnumField(title: "Sonuç Durumu", selection: $durum)
            }

            Section {
                KBFormActions(
                    saveTitle: "Görevi Kapat",
                    isSaving: isSaving,
                    isEnabled: kmHatasi == nil
                ) {
                    Task {
                        isSaving = true
                        let ok = await onClose(
                            TaskCloseRequestDTO(
                                girisTarihi: girisTarihi?.kbIsoAn,
                                kmSayacGiris: KBNumberFormat.parse(kmSayacGiris),
                                durum: durum.rawValue
                            )
                        )
                        isSaving = false
                        if ok { dismiss() }
                    }
                }
            }
        }
        .navigationTitle("Görevi Kapat")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

@MainActor
final class TaskDetailViewModel: ObservableObject {
    @Published private(set) var gorev: TaskDetailDTO?
    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let taskId: String
    private let api: APIClient

    init(taskId: String, api: APIClient = .shared) {
        self.taskId = taskId
        self.api = api
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            gorev = try await api.fetchTask(id: taskId)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func baslat(kmSayacCikis: Double?) async {
        isSaving = true
        errorMessage = nil
        do {
            gorev = try await api.startTask(id: taskId, kmSayacCikis: kmSayacCikis)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isSaving = false
    }

    func kapat(_ istek: TaskCloseRequestDTO) async -> Bool {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            gorev = try await api.closeTask(
                id: taskId,
                girisTarihi: istek.girisTarihi,
                kmSayacGiris: istek.kmSayacGiris,
                durum: TaskClosingStatus(rawValue: istek.durum) ?? .TAMAMLANDI
            )
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}
