import SwiftUI

struct DestinationView: View {
    let destination: NavDestination

    var body: some View {
        content
            // Modül ekranlarının push ettiği detay hedefleri tek yerde kayıtlı;
            // her modülün ayrı ayrı kaydetmesi aynı yığında çakışmaya yol açar.
            .navigationDestination(for: PanelRoute.self) { route in
                switch route {
                case let .vehicle(id):
                    VehicleDetailView(vehicleId: id)
                case let .personnel(id):
                    PersonnelDetailView(personnelId: id)
                case let .complaint(id):
                    ComplaintDetailView(complaintId: id)
                case let .workItemComplaint(id):
                    WorkItemComplaintView(complaintId: id)
                case let .checklist(id):
                    ChecklistDetailView(submissionId: id)
                case let .task(id):
                    TaskDetailView(taskId: id)
                case let .taskTrack(id):
                    TaskTrackReportView(taskId: id)
                }
            }
    }

    @ViewBuilder
    private var content: some View {
        switch destination {
        case .dashboard:
            DashboardView()
        case .komuta:
            KomutaView()
        case .harita:
            MapScreen()
        case .parsel:
            ParcelView()
        case .kis:
            WinterView()
        case .cop:
            WasteView()
        case .temizlik:
            CleaningView()
        case .sikayetler:
            ComplaintsListView()
        case .islerim:
            WorkItemsView()
        case .whatsapp:
            WhatsAppView()
        case .gorevler:
            TasksView()
        case .kontrol:
            ChecklistsView()
        case .araclar:
            VehiclesView()
        case .bakim:
            MaintenanceView()
        case .yakit:
            FuelView()
        case .akaryakit:
            AkaryakitAnalysisView()
        case .malzemeDepo:
            MaterialsView()
        case .beton:
            ConcreteView()
        case .agrega:
            AgregaCostView()
        case .bitum:
            BitumTrackingView()
        case .personel:
            PersonnelListView()
        case .gunlukCalisma:
            WorkLogsView()
        case .raporlar:
            RaporlarView()
        case .tanimlar:
            TanimlarView()
        case .denetim:
            DenetimView()
        }
    }
}
