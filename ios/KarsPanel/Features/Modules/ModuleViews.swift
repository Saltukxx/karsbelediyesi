import SwiftUI

struct ModuleListView: View {
    let destination: NavDestination
    @StateObject private var viewModel = ModuleListViewModel()

    var body: some View {
        List {
            if let error = viewModel.errorMessage {
                Section { ErrorBanner(message: error) }
            }

            if viewModel.rows.isEmpty, !viewModel.isLoading {
                Section {
                    EmptyStateView(
                        title: "Kayıt bulunamadı",
                        systemImage: destination.icon,
                        message: "Bu modülde gösterilecek kayıt yok. Aşağı çekerek yenileyin."
                    )
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            } else {
                Section {
                    ForEach(viewModel.rows) { row in
                        ModuleRowView(row: row) {
                            ForEach(row.actions) { action in
                                Button {
                                    Task { await viewModel.perform(action: action, destination: destination) }
                                } label: {
                                    Text(action.label)
                                        .font(.caption.weight(.semibold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 7)
                                        .background(action.destructive ? KBTheme.danger.opacity(0.12) : KBTheme.navy.opacity(0.1))
                                        .foregroundStyle(action.destructive ? KBTheme.danger : KBTheme.navy)
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            ForEach(row.actions) { action in
                                Button(action.label) {
                                    Task { await viewModel.perform(action: action, destination: destination) }
                                }
                                .tint(action.destructive ? .red : KBTheme.navy)
                            }
                        }
                    }
                } footer: {
                    if destination == .whatsapp {
                        Text("İşlemler için sağa kaydırın veya satırdaki düğmeleri kullanın.")
                            .font(.caption)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(destination.shortLabel)
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await viewModel.load(destination: destination) }
        .task(id: destination) { await viewModel.load(destination: destination) }
        .overlay {
            if viewModel.isLoading && viewModel.rows.isEmpty { LoadingOverlay() }
        }
    }
}

private struct ModuleRowView<Actions: View>: View {
    let row: ModuleListViewModel.ModuleRow
    @ViewBuilder var actions: () -> Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(row.primary)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(KBTheme.navy)
                .lineLimit(2)

            if let secondary = row.secondary, !secondary.isEmpty {
                Text(secondary)
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
                    .lineLimit(3)
            }

            let actionViews = actions()
            HStack(spacing: 8) {
                actionViews
                Spacer(minLength: 0)
            }
        }
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

// Yalnızca WhatsApp kuyruğu genel liste iskeletini kullanıyor; diğer modüller
// kendi ekranlarına taşındı.
struct WhatsAppView: View { var body: some View { ModuleListView(destination: .whatsapp) } }
