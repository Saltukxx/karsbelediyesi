import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var dashboard: DashboardDTO?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var preset: DashboardRangePreset = .d30
    @Published var customStart = Calendar.current.date(byAdding: .day, value: -29, to: Date()) ?? Date()
    @Published var customEnd = Date()

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var rangeCaption: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "yyyy-MM-dd"
        if let bas = dashboard?.bas, let bit = dashboard?.bit {
            return "\(formatter.string(from: bas)) — \(formatter.string(from: bit))"
        }
        if preset == .custom {
            return "\(formatter.string(from: customStart)) — \(formatter.string(from: customEnd))"
        }
        return preset.label
    }

    func load() async {
        if dashboard == nil { isLoading = true }
        defer { isLoading = false }
        do {
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 3 * 3600)
            formatter.dateFormat = "yyyy-MM-dd"
            let bas = preset == .custom ? formatter.string(from: customStart) : nil
            let bit = preset == .custom ? formatter.string(from: customEnd) : nil
            dashboard = try await api.fetchDashboard(aralik: preset.rawValue, bas: bas, bit: bit)
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            if Task.isCancelled || Self.isCancellation(error) { return }
            if let apiError = error as? APIError {
                errorMessage = apiError.errorDescription
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }

    private static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let urlError = error as? URLError, urlError.code == .cancelled { return true }
        if let apiError = error as? APIError, case .network(let inner) = apiError {
            return isCancellation(inner)
        }
        let ns = error as NSError
        return ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled
    }

    func applyPreset(_ next: DashboardRangePreset) async {
        preset = next
        await load()
    }
}
