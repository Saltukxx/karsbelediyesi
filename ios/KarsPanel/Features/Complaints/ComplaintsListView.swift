import SwiftUI

struct ComplaintsListView: View {
    @StateObject private var viewModel = ComplaintsViewModel()
    @State private var arama = ""
    @State private var showCreate = false

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Şikayetler",
            description: "Çağrı merkezi kayıtları ve çözüm takibi.",
            action: KBHeaderAction(title: "Yeni Şikayet") { showCreate = true },
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: viewModel.complaints.isEmpty ? "Kayıt bulunamadı" : "Aramaya uyan kayıt yok",
                systemImage: "phone.fill",
                message: viewModel.complaints.isEmpty
                    ? "Bu sekmede şikayet yok. Yeni kayıt ekleyebilirsiniz."
                    : "Farklı bir şikayet no, arayan kişi veya tür araması deneyin.",
                actionTitle: viewModel.complaints.isEmpty ? "Yeni Şikayet" : nil,
                action: viewModel.complaints.isEmpty ? { showCreate = true } : nil
            ),
            refresh: { await viewModel.load() }
        ) {
            KBSegmentedTabs(selection: $viewModel.tab, items: sekmeler)
            KBSearchField(text: $arama, placeholder: "Şikayet no, arayan kişi veya tür ara...")

            ForEach(liste) { sikayet in
                NavigationLink(value: sikayet.id) {
                    KBRecordCard(
                        title: sikayet.sikayetNo ?? "—",
                        badges: rozetler(sikayet),
                        subtitle: sikayet.arayanKisi,
                        meta: meta(sikayet),
                        accent: vurgu(sikayet),
                        showsChevron: true
                    )
                }
                .buttonStyle(.plain)
            }

            if viewModel.canLoadMore {
                KBLoadMoreCard(
                    sayi: viewModel.complaints.count,
                    birim: "şikayet",
                    isLoading: viewModel.isLoading
                ) {
                    Task { await viewModel.loadMore() }
                }
            }
        }
        .navigationDestination(for: String.self) { id in
            ComplaintDetailView(complaintId: id)
        }
        .sheet(isPresented: $showCreate) {
            NavigationStack {
                ComplaintCreateView {
                    showCreate = false
                    Task { await viewModel.load() }
                }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .task(id: viewModel.tab) { await viewModel.loadTab() }
    }

    private var sekmeler: [KBTabItem<ComplaintTab>] {
        ComplaintTab.allCases.map { KBTabItem(value: $0, label: $0.shortLabel) }
    }

    private var gorunen: [ComplaintDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return viewModel.complaints }
        return viewModel.complaints.filter { sikayet in
            [sikayet.sikayetNo, sikayet.arayanKisi, sikayet.complaintType?.name, sikayet.aciklama]
                .contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func rozetler(_ sikayet: ComplaintDTO) -> [KBBadge] {
        var rozetler: [KBBadge] = []
        if let durum = sikayet.durum {
            rozetler.append(KBBadge(text: durum.label, tone: durum.badgeTone))
        }
        if let oncelik = sikayet.oncelik, oncelik != .NORMAL {
            rozetler.append(KBBadge(text: oncelik.label, tone: oncelik.badgeTone))
        }
        return rozetler
    }

    private func meta(_ sikayet: ComplaintDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let tur = sikayet.complaintType?.name {
            chips.append(KBMetaChip(icon: "tag", text: tur))
        }
        if let mahalle = sikayet.neighborhood?.name {
            chips.append(KBMetaChip(icon: "mappin", text: mahalle))
        }
        if let tarih = KBFormat.tarih(sikayet.kayitTarihi) {
            chips.append(KBMetaChip(icon: "calendar", text: tarih))
        }
        if let kanal = KBStatus.kanal(sikayet.kanal) {
            chips.append(KBMetaChip(icon: "antenna.radiowaves.left.and.right", text: kanal))
        }
        return chips
    }

    private func vurgu(_ sikayet: ComplaintDTO) -> Color {
        switch sikayet.durum {
        case .ACIK: return KBTheme.info
        case .DEVAM_EDIYOR: return KBTheme.warning
        case .KAPATILDI: return KBTheme.success
        case .IPTAL, .none: return KBTheme.muted
        }
    }
}

extension ComplaintTab {
    var shortLabel: String {
        switch self {
        case .aktif: return "Aktif"
        case .kapali: return "Kapalı"
        case .tumu: return "Tümü"
        }
    }
}
