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
    @Published var selected: ComplaintDTO?
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
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadDetail(id: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            selected = try await api.fetchComplaint(id: id)
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
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
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        return false
    }

    func update(id: String, request: UpdateComplaintRequestDTO) async -> Bool {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let updated = try await api.updateComplaint(id: id, body: request)
            if let index = complaints.firstIndex(where: { $0.id == id }) {
                complaints[index] = updated
            }
            selected = updated
            return true
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        return false
    }
}
