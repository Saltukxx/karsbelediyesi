import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var viewModel = DashboardViewModel()

    private var isFieldRole: Bool {
        switch session.user?.role {
        case .DRIVER, .FIELD_WORKER: return true
        case .ADMIN, .CALL_CENTER, .DEPARTMENT_MANAGER, .APPROVER, .none: return false
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                content
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .refreshable { await viewModel.load() }
        .kbScreenBackground()
        .kbNavigationChrome(title: "Dashboard")
        .task { await viewModel.load() }
        .overlay {
            if viewModel.isLoading && viewModel.dashboard == nil { LoadingOverlay() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let error = viewModel.errorMessage {
            ErrorBanner(message: error)
        }

        if isFieldRole {
            fieldLanding
        } else if let dashboard = viewModel.dashboard {
            analyticsDashboard(
                dashboard: dashboard,
                kpi: dashboard.displayKpi,
                anlik: dashboard.displayAnlik
            )
        } else if !viewModel.isLoading {
            EmptyStateView(
                title: "Özet verisi yok",
                systemImage: "square.grid.2x2",
                message: "Aşağı çekerek yenileyebilirsiniz."
            )
        }
    }

    private var fieldLanding: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("İşlerim üzerinden devam edin")
                .font(.title3.weight(.bold))
                .foregroundStyle(KBTheme.navy)
            Text("Saha rollerinde analitik özet yerine atanan görevler gösterilir.")
                .font(.subheadline)
                .foregroundStyle(KBTheme.muted)
            NavigationLink {
                DestinationView(destination: .islerim)
            } label: {
                Text("İşlerime git")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(KBPrimaryButtonStyle())
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private func analyticsDashboard(
        dashboard: DashboardDTO,
        kpi: DashboardKpiDTO,
        anlik: DashboardAnlikDTO
    ) -> some View {
        DashboardSearchField()

        if anlik.yaklasanMuayene > 0 {
            DashboardWarningBanner(count: anlik.yaklasanMuayene, kirilim: anlik.yaklasanMuayeneKirilim)
        }

        DashboardRangeBar(viewModel: viewModel)

        DashboardSectionTitle(title: "Seçili dönem", subtitle: "önceki dönemle karşılaştırma")
        LazyVGrid(columns: twoColumns, spacing: 10) {
            DashboardKpiCard(label: "Yeni şikayet", delta: kpi.yeniSikayet, destination: .sikayetler)
            DashboardKpiCard(label: "Kapatılan şikayet", delta: kpi.kapatilanSikayet, destination: .sikayetler)
            DashboardKpiCard(label: "Ort. kapanış süresi", delta: kpi.ortKapanisGun, format: .days, lowerIsBetter: true)
            DashboardKpiCard(label: "Tamamlanan görev", delta: kpi.tamamlananGorev, destination: .gorevler)
            DashboardKpiCard(
                label: "Operasyon maliyeti",
                delta: kpi.operasyonMaliyeti,
                format: .money,
                lowerIsBetter: true,
                hint: "bakım + yakıt"
            )
        }

        DashboardSectionTitle(title: "Bugün yapılacaklar", subtitle: "ilgili ekrana gider")
        LazyVGrid(columns: twoColumns, spacing: 10) {
            DashboardActionCard(
                title: "Acil şikayet",
                count: anlik.acilSikayet,
                hint: "Açık / devam · acil & çok acil",
                icon: "exclamationmark.triangle.fill",
                tone: anlik.acilSikayet > 0 ? KBTheme.danger : KBTheme.navy,
                destination: .sikayetler
            )
            DashboardActionCard(
                title: "WhatsApp onay",
                count: anlik.onayBekleyenWhatsApp,
                hint: "Onay bekleyen mesaj",
                icon: "message.fill",
                tone: anlik.onayBekleyenWhatsApp > 0 ? KBTheme.warning : KBTheme.navy,
                destination: .whatsapp
            )
            DashboardActionCard(
                title: "Kritik stok",
                count: anlik.kritikStokToplam,
                hint: "Malzeme / beton / bitüm",
                icon: "shippingbox.fill",
                tone: anlik.kritikStokToplam > 0 ? KBTheme.danger : KBTheme.success,
                destination: stokDestination(anlik)
            )
            DashboardActionCard(
                title: "Muayene / sigorta",
                count: anlik.yaklasanMuayene,
                hint: muayeneHint(anlik.yaklasanMuayeneKirilim),
                icon: "wrench.and.screwdriver.fill",
                tone: anlik.yaklasanMuayene > 0 ? KBTheme.warning : KBTheme.navy,
                destination: .araclar
            )
            DashboardActionCard(
                title: "Devam eden görev",
                count: anlik.devamGorev,
                hint: "Sahada devam eden işler",
                icon: "list.clipboard.fill",
                tone: anlik.devamGorev > 0 ? KBTheme.warning : KBTheme.navy,
                destination: .gorevler
            )
            DashboardActionCard(
                title: "Konum eksik",
                count: anlik.konumEksikAcik,
                hint: "Açık şikayet — haritada görünmez",
                icon: "mappin.and.ellipse",
                tone: anlik.konumEksikAcik > 0 ? KBTheme.warning : KBTheme.navy,
                destination: .harita
            )
        }

        // Kart sırası web paneliyle aynı tutulur; iki platformda aynı okuma düzeni.
        DashboardSectionTitle(title: "Eğilimler", subtitle: viewModel.rangeCaption)
        DashboardTrendChart(points: dashboard.trend ?? [])
        DashboardDepartmentChart(items: dashboard.mudurlukDagilim ?? [])
        DashboardTypeChart(items: dashboard.turDagilim ?? [])
        DashboardSlaChart(sla: dashboard.sla ?? DashboardSlaDTO(bucketLt24h: 0, bucket1to3d: 0, bucketGt3d: 0))
        DashboardVehicleStatusChart(aracOperasyon: anlik.aracOperasyon ?? [:])
        DashboardChannelChart(items: dashboard.kanalDagilim ?? [])
        DashboardNeighborhoodChart(items: dashboard.mahalleDagilim ?? [])
        DashboardHeatMapCard(coordinates: dashboard.sikayetKonumlari ?? [])
        DashboardHourHeatmap(cells: dashboard.saatlikYogunluk ?? [])
        DashboardCostChart(points: dashboard.maliyetTrend ?? [])

        DashboardSectionTitle(title: "Anlık durum")
        LazyVGrid(columns: twoColumns, spacing: 10) {
            DashboardAnlikTile(title: "Açık şikayet", value: anlik.acikSikayet, tone: KBTheme.info)
            DashboardAnlikTile(title: "Devam eden", value: anlik.devamEdenSikayet, tone: KBTheme.warning)
            DashboardAnlikTile(
                title: "Çok acil",
                value: anlik.cokAcil,
                tone: anlik.cokAcil > 0 ? KBTheme.danger : KBTheme.navy
            )
            DashboardAnlikTile(title: "Acil", value: anlik.acil, tone: KBTheme.warning)
            DashboardAnlikTile(
                title: "Kritik stok",
                value: anlik.kritikStokToplam,
                tone: anlik.kritikStokToplam > 0 ? KBTheme.danger : KBTheme.success
            )
            DashboardAnlikTile(
                title: "Yaklaşan bakım",
                value: anlik.yaklasanMuayene,
                tone: KBTheme.warning,
                hint: muayeneHint(anlik.yaklasanMuayeneKirilim)
            )
        }
    }

    private var twoColumns: [GridItem] {
        [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    }

    private func stokDestination(_ anlik: DashboardAnlikDTO) -> NavDestination {
        if (anlik.kritikBeton ?? 0) > 0 { return .beton }
        if (anlik.kritikBitum ?? 0) > 0 { return .bitum }
        return .malzemeDepo
    }

    private func muayeneHint(_ kirilim: DashboardMuayeneKirilimDTO?) -> String {
        guard let k = kirilim else { return "≤30 gün veya geçmiş" }
        return "M \(k.muayene) · S \(k.sigorta) · B \(k.bakim)"
    }

}
