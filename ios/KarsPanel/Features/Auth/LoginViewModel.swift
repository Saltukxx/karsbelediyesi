import Foundation

@MainActor
final class LoginViewModel: ObservableObject {
    @Published var phone = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var canSubmit: Bool {
        !phone.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty && !isLoading
    }

    func submit(session: AppSession) async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        let normalizedPhone = phone.replacingOccurrences(of: " ", with: "")
        do {
            let response = try await api.login(phone: normalizedPhone, password: password)
            session.signIn(user: response.user, token: response.token)
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
