import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var viewModel = DashboardViewModel()

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                greetingHeader

                if let error = viewModel.errorMessage {
                    ErrorBanner(message: error)
                }

                if let dashboard = viewModel.dashboard {
                    LazyVGrid(columns: columns, spacing: 12) {
                        StatTile(title: "Açık Şikayet", value: dashboard.acikSikayetler ?? 0, icon: "phone.fill", tint: KBTheme.info)
                        StatTile(title: "Devam Eden", value: dashboard.devamEdenSikayetler ?? 0, icon: "arrow.triangle.2.circlepath", tint: KBTheme.warning)
                        StatTile(title: "Aktif Görev", value: dashboard.aktifGorevler ?? 0, icon: "list.clipboard.fill", tint: KBTheme.navy)
                        StatTile(title: "WhatsApp", value: dashboard.bekleyenWhatsApp ?? 0, icon: "message.fill", tint: KBTheme.success)
                        StatTile(title: "Aktif Araç", value: dashboard.aktifAraclar ?? 0, icon: "truck.box.fill", tint: KBTheme.accent)
                        StatTile(title: "Bakım", value: dashboard.bakimGereken ?? 0, icon: "wrench.and.screwdriver.fill", tint: KBTheme.danger)
                    }

                    if let recent = dashboard.sonSikayetler, !recent.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionHeaderLabel(title: "Son Şikayetler", subtitle: "En güncel kayıtlar")
                            ForEach(recent) { item in
                                HStack(spacing: 12) {
                                    Image(systemName: "phone.fill")
                                        .foregroundStyle(KBTheme.accent)
                                        .frame(width: 28)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.sikayetNo ?? item.id)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(KBTheme.navy)
                                        Text(item.arayanKisi ?? "—")
                                            .font(.caption)
                                            .foregroundStyle(KBTheme.muted)
                                    }
                                    Spacer(minLength: 8)
                                    if let durum = item.durum {
                                        StatusBadge(
                                            text: durumLabel(durum),
                                            tone: durumTone(durum)
                                        )
                                    }
                                }
                                .padding(.vertical, 4)
                                if item.id != recent.last?.id {
                                    Divider()
                                }
                            }
                        }
                        .kbCard()
                    }

                    if let tasks = dashboard.sonGorevler, !tasks.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionHeaderLabel(title: "Son Görevler")
                            ForEach(tasks) { item in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.gorevNo ?? item.id)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(KBTheme.navy)
                                        Text(item.plaka ?? "—")
                                            .font(.caption)
                                            .foregroundStyle(KBTheme.muted)
                                    }
                                    Spacer()
                                    StatusBadge(text: item.durum ?? "—", tone: .neutral)
                                }
                                if item.id != tasks.last?.id {
                                    Divider()
                                }
                            }
                        }
                        .kbCard()
                    }
                } else if !viewModel.isLoading {
                    EmptyStateView(
                        title: "Özet verisi yok",
                        systemImage: "square.grid.2x2",
                        message: "Aşağı çekerek yenileyebilirsiniz."
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .kbScreenBackground()
        .navigationTitle(dashboardTitle)
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .overlay {
            if viewModel.isLoading && viewModel.dashboard == nil { LoadingOverlay() }
        }
    }

    private var greetingHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greeting)
                .font(.title3.weight(.bold))
                .foregroundStyle(KBTheme.navy)
            if let name = session.user?.name {
                Text(name)
                    .font(.subheadline)
                    .foregroundStyle(KBTheme.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Günaydın"
        case 12..<18: return "İyi günler"
        default: return "İyi akşamlar"
        }
    }

    private var dashboardTitle: String {
        guard let role = session.user?.role else { return "Dashboard" }
        return NavItemCatalog.label(for: .dashboard, role: role)
    }

    private func durumLabel(_ raw: String) -> String {
        ComplaintStatus(rawValue: raw)?.label ?? raw
    }

    private func durumTone(_ raw: String) -> StatusBadge.Tone {
        ComplaintStatus(rawValue: raw)?.badgeTone ?? .neutral
    }
}

private struct StatTile: View {
    let title: String
    let value: Int
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: icon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 32, height: 32)
                    .background(tint.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                Spacer()
            }
            Text("\(value)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(KBTheme.navy)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(KBTheme.muted)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .topLeading)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                .stroke(KBTheme.border, lineWidth: 1)
        )
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(tint)
                .frame(width: 3)
                .padding(.vertical, 12)
        }
    }
}
