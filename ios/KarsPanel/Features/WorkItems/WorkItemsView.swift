import SwiftUI

/// `/islerim` — saha personelinin ve şoförün yalnızca kendisine atanan işleri.
/// Web'deki üç bölüm (araç görevleri, şikayetler, asfalt rotaları) korunur.
struct WorkItemsView: View {
    @StateObject private var viewModel = WorkItemsViewModel()

    var body: some View {
        KBModuleScreen(
            title: NavDestination.islerim.label,
            icon: NavDestination.islerim.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.bosMu,
            emptyMessage: "Size atanmış iş bulunmuyor. Yeni atama yapıldığında burada görünür.",
            onRefresh: { await viewModel.load() }
        ) {
            if let personel = viewModel.data?.personel {
                Section {
                    KBDetailRow(label: "Personel", value: personel.adSoyad)
                    KBDetailRow(label: "Müdürlük", value: personel.mudurluk)
                }
            }

            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    .listRowBackground(Color.clear)
            }

            if !viewModel.aracGorevleri.isEmpty {
                Section("Araç Görevlerim (\(viewModel.aracGorevleri.count))") {
                    ForEach(viewModel.aracGorevleri) { gorev in
                        NavigationLink(value: PanelRoute.task(gorev.id)) {
                            KBListRow(
                                title: "\(gorev.gorevNo) · \(gorev.plaka)",
                                subtitle: gorev.gorevYeri ?? gorev.gorevTanimi,
                                detail: gorevDetay(gorev),
                                badge: TaskStatus(rawValue: gorev.durum)?.displayName
                                    ?? gorev.durum,
                                badgeTone: (TaskStatus(rawValue: gorev.durum)?.badgeTone
                                    ?? .neutral).badge
                            )
                        }
                    }
                }
            }

            if !viewModel.sikayetler.isEmpty {
                Section("Şikayetlerim (\(viewModel.sikayetler.count))") {
                    ForEach(viewModel.sikayetler) { sikayet in
                        NavigationLink(value: PanelRoute.workItemComplaint(sikayet.id)) {
                            KBListRow(
                                title: "\(sikayet.sikayetNo) · \(sikayet.arayanKisi ?? "—")",
                                subtitle: sikayet.aciklama,
                                detail: sikayetDetay(sikayet),
                                badge: sikayet.durum.label,
                                badgeTone: sikayet.durum.badgeTone
                            )
                        }
                    }
                }
            }

            if !viewModel.rotalar.isEmpty {
                Section("Asfalt Rotalarım (\(viewModel.rotalar.count))") {
                    ForEach(viewModel.rotalar) { rota in
                        WorkItemRoadRow(
                            rota: rota,
                            isSaving: viewModel.kaydedilenRotaId == rota.id
                        ) { durum in
                            Task { await viewModel.rotaDurumGuncelle(id: rota.id, durum: durum) }
                        }
                    }
                }
            }
        }
        .task { if viewModel.data == nil { await viewModel.load() } }
    }

    private func gorevDetay(_ gorev: WorkItemTaskDTO) -> String? {
        var parts: [String] = []
        if let cikis = gorev.cikisTarihi { parts.append("Çıkış: \(cikis.kbAn)") }
        if let giris = gorev.girisTarihi { parts.append("Giriş: \(giris.kbAn)") }
        if gorev.takipVar { parts.append("Rota takibi var") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func sikayetDetay(_ sikayet: WorkItemComplaintDTO) -> String? {
        [sikayet.mahalle, sikayet.tur, sikayet.oncelik.label]
            .compactMap { $0 }
            .joined(separator: " · ")
    }
}

/// Rota satırı durumu doğrudan listeden değiştirilir; web'de de ayrı detay
/// sayfası yoktur.
private struct WorkItemRoadRow: View {
    let rota: WorkItemRoadDTO
    let isSaving: Bool
    let onChange: (AsphaltStatus) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            KBListRow(
                title: rota.ad,
                subtitle: [rota.mudurluk, rota.dokumTarihi?.kbGun]
                    .compactMap { $0 }
                    .joined(separator: " · "),
                detail: rota.notlar,
                badge: AsphaltStatus(rawValue: rota.durum)?.displayName ?? rota.durum,
                badgeTone: (AsphaltStatus(rawValue: rota.durum)?.badgeTone ?? .neutral).badge
            )

            if isSaving {
                ProgressView().frame(maxWidth: .infinity, alignment: .leading)
            } else {
                HStack(spacing: 8) {
                    ForEach(AsphaltStatus.allCases.filter { $0.rawValue != rota.durum }) { hedef in
                        Button(hedef.displayName) { onChange(hedef) }
                            .buttonStyle(KBChipButtonStyle())
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }
}

@MainActor
final class WorkItemsViewModel: ObservableObject {
    @Published private(set) var data: WorkItemsDTO?
    @Published private(set) var isLoading = false
    @Published private(set) var kaydedilenRotaId: String?
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var aracGorevleri: [WorkItemTaskDTO] { data?.aracGorevleri ?? [] }
    var sikayetler: [WorkItemComplaintDTO] { data?.sikayetler ?? [] }
    var rotalar: [WorkItemRoadDTO] { data?.rotalar ?? [] }

    var bosMu: Bool {
        aracGorevleri.isEmpty && sikayetler.isEmpty && rotalar.isEmpty
    }

    var ozet: [KBStat] {
        [
            KBStat(label: "Araç görevi", value: "\(aracGorevleri.count)"),
            KBStat(
                label: "Açık şikayet",
                value: "\(sikayetler.filter { $0.durum == .ACIK || $0.durum == .DEVAM_EDIYOR }.count)",
                tone: .warning
            ),
            KBStat(
                label: "Süren rota",
                value: "\(rotalar.filter { $0.durum != AsphaltStatus.TAMAMLANDI.rawValue }.count)",
                tone: .info
            ),
        ]
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            data = try await api.fetchWorkItems()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func rotaDurumGuncelle(id: String, durum: AsphaltStatus) async {
        kaydedilenRotaId = id
        errorMessage = nil
        do {
            try await api.updateWorkItemRoadStatus(id: id, durum: durum)
            await load()
        } catch {
            errorMessage = APIError.describe(error)
        }
        kaydedilenRotaId = nil
    }
}
