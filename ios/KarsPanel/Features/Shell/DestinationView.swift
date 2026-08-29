import SwiftUI

struct DestinationView: View {
    let destination: NavDestination

    var body: some View {
        switch destination {
        case .dashboard:
            DashboardView()
        case .komuta:
            KomutaView()
        case .raporlar:
            ReportsView()
        case .sikayetler:
            ComplaintsListView()
        case .islerim:
            IslerimView()
        case .whatsapp:
            WhatsAppQueueView()
        case .gorevler:
            TasksView()
        case .kontrol:
            ChecklistsView()
        case .harita:
            HaritaView()
        case .parsel:
            ParselView()
        case .kis:
            FieldRouteView(kind: "kis", title: destination.label, subtitle: destination.summary)
        case .cop:
            FieldRouteView(kind: "cop", title: destination.label, subtitle: destination.summary)
        case .temizlik:
            FieldRouteView(kind: "temizlik", title: destination.label, subtitle: destination.summary)
        case .araclar:
            VehiclesView()
        case .bakim:
            MaintenanceView()
        case .yakit:
            FuelView()
        case .akaryakit:
            FuelAnalysisView()
        case .malzemeDepo:
            MaterialsView()
        case .beton:
            ConcreteView()
        case .agrega:
            AgregaView()
        case .bitum:
            BitumView()
        case .personel:
            PersonnelView()
        case .gunlukCalisma:
            WorkLogsView()
        case .tanimlar:
            DefinitionsView()
        case .denetim:
            AuditView()
        }
    }
}
