import Foundation

enum ComplaintTab: String, CaseIterable, Identifiable {
    case aktif
    case kapali
    case tumu

    var id: String { rawValue }

    var label: String {
        switch self {
        case .aktif: return "Aktif İşler"
        case .kapali: return "Kapalı İşler"
        case .tumu: return "Tümü"
        }
    }
}

@MainActor
final class ComplaintsViewModel: ObservableObject {
    @Published var tab: ComplaintTab = .aktif
    @Published var complaints: [ComplaintDTO] = []
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let sekme = tab == .tumu ? nil : tab.rawValue
            complaints = try await api.fetchComplaints(sekme: sekme)
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    func create(_ request: CreateComplaintRequestDTO) async -> Bool {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let created = try await api.createComplaint(request)
            complaints.insert(created, at: 0)
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}
