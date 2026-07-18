import SwiftUI

struct ComplaintsListView: View {
    @StateObject private var viewModel = ComplaintsViewModel()
    @State private var showCreate = false

    var body: some View {
        List {
            Section {
                Picker("Sekme", selection: $viewModel.tab) {
                    ForEach(ComplaintTab.allCases) { tab in
                        Text(tab.shortLabel).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                .listRowBackground(Color.clear)
            }

            if let error = viewModel.errorMessage {
                Section { ErrorBanner(message: error) }
            }

            Section {
                if viewModel.complaints.isEmpty, !viewModel.isLoading {
                    EmptyStateView(
                        title: "Kayıt bulunamadı",
                        systemImage: "phone",
                        message: "Bu sekmede şikayet yok. Yeni kayıt ekleyebilirsiniz.",
                        actionTitle: "Yeni Şikayet",
                        action: { showCreate = true }
                    )
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                } else {
                    ForEach(viewModel.complaints) { complaint in
                        NavigationLink(value: complaint.id) {
                            ComplaintRow(complaint: complaint)
                        }
                        .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle("Şikayetler")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: String.self) { id in
            ComplaintDetailView(complaintId: id)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
                }
                .accessibilityLabel("Yeni şikayet")
            }
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
        .refreshable { await viewModel.load() }
        .task(id: viewModel.tab) { await viewModel.load() }
        .overlay {
            if viewModel.isLoading && viewModel.complaints.isEmpty { LoadingOverlay() }
        }
    }
}

private struct ComplaintRow: View {
    let complaint: ComplaintDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(complaint.sikayetNo ?? "—")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(KBTheme.navy)
                Spacer(minLength: 8)
                if let durum = complaint.durum {
                    StatusBadge(text: durum.label, tone: durum.badgeTone)
                }
            }

            Text(complaint.arayanKisi ?? "—")
                .font(.body.weight(.medium))
                .foregroundStyle(KBTheme.navy)
                .lineLimit(1)

            HStack(spacing: 8) {
                Label(complaint.complaintType?.name ?? "Tür yok", systemImage: "tag")
                    .lineLimit(1)
                Spacer(minLength: 4)
                if let oncelik = complaint.oncelik {
                    StatusBadge(text: oncelik.label, tone: oncelik.badgeTone)
                }
            }
            .font(.caption)
            .foregroundStyle(KBTheme.muted)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

private extension ComplaintTab {
    var shortLabel: String {
        switch self {
        case .aktif: return "Aktif"
        case .kapali: return "Kapalı"
        case .tumu: return "Tümü"
        }
    }
}
