import SwiftUI

/// Sunucu adresi ayarı. Kurum içi dağıtımda ve saha testinde farklı bir panel
/// adresine bağlanmayı sağlar; adres değişimi oturumu düşürür.
struct ServerSettingsView: View {
    @EnvironmentObject private var session: AppSession
    @Environment(\.dismiss) private var dismiss

    @State private var address: String = ""
    @State private var validationError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("karsbelediyesi.gbsoftt.com", text: $address)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onChange(of: address) { _, _ in validationError = nil }
                } header: {
                    Text("Sunucu adresi")
                } footer: {
                    if let validationError {
                        Text(validationError).foregroundStyle(KBTheme.danger)
                    } else {
                        Text("Adres değiştirildiğinde oturumunuz kapatılır.")
                    }
                }

                Section("Etkin yapılandırma") {
                    LabeledContent("Bağlanılan", value: session.baseURL.absoluteString)
                    LabeledContent("Uygulama sürümü", value: AppConfig.appVersion)
                }

                Section {
                    Button("Varsayılana dön") {
                        session.updateBaseURL(nil)
                        address = ""
                        dismiss()
                    }
                }
            }
            .navigationTitle("Sunucu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Kaydet", action: save)
                }
            }
            .onAppear {
                address = UserDefaults.standard
                    .string(forKey: AppConfig.overrideDefaultsKey) ?? ""
            }
        }
    }

    private func save() {
        let trimmed = address.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            session.updateBaseURL(nil)
            dismiss()
            return
        }
        guard AppConfig.normalize(trimmed) != nil else {
            validationError = "Geçerli bir http/https adresi girin."
            return
        }
        session.updateBaseURL(trimmed)
        dismiss()
    }
}
