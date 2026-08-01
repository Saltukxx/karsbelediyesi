import Foundation

@MainActor
final class ModuleListViewModel: ObservableObject {
    @Published var title = ""
    @Published var rows: [ModuleRow] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    struct ModuleAction: Identifiable, Hashable {
        let id: String
        let recordId: String
        let label: String
        let kind: String
        let destructive: Bool
    }

    struct ModuleRow: Identifiable, Hashable {
        let id: String
        let primary: String
        let secondary: String?
        var actions: [ModuleAction] = []
    }

    func load(destination: NavDestination) async {
        title = destination.label
        isLoading = true
        errorMessage = nil
        rows = []
        defer { isLoading = false }

        do {
            rows = try await fetchRows(for: destination)
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    func perform(action: ModuleAction, destination: NavDestination) async {
        errorMessage = nil
        do {
            switch destination {
            case .whatsapp:
                _ = try await api.updateWhatsApp(id: action.recordId, action: action.kind)
            default:
                return
            }
            await load(destination: destination)
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    private func fetchRows(for destination: NavDestination) async throws -> [ModuleRow] {
        switch destination {
        case .whatsapp:
            return try await api.fetchWhatsAppQueue().map {
                ModuleRow(
                    id: $0.id,
                    primary: $0.telefon ?? "—",
                    secondary: $0.icerik,
                    actions: [
                        ModuleAction(
                            id: "\($0.id)-approve",
                            recordId: $0.id,
                            label: "Onayla",
                            kind: "approve",
                            destructive: false
                        ),
                        ModuleAction(
                            id: "\($0.id)-reject",
                            recordId: $0.id,
                            label: "Reddet",
                            kind: "reject",
                            destructive: true
                        ),
                    ]
                )
            }
        // Kendi ekranı olan modüller `ModuleListView` kullanmaz
        case .dashboard, .komuta, .harita, .parsel, .kis, .cop, .temizlik, .sikayetler,
             .islerim, .gorevler, .kontrol, .araclar, .bakim, .yakit, .akaryakit,
             .malzemeDepo, .beton, .agrega, .bitum, .personel, .gunlukCalisma,
             .raporlar, .tanimlar, .denetim:
            return []
        }
    }
}
