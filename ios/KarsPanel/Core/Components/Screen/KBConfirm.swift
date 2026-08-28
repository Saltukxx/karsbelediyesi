import SwiftUI

/// Yıkıcı işlemler (hurdaya ayırma, pasife alma, görev kapatma) için ortak onay akışı.
struct KBConfirmRequest: Identifiable {
    let id = UUID()
    let title: String
    var message: String? = nil
    var confirmTitle = "Onayla"
    var destructive = true
    let action: () -> Void
}

extension View {
    func kbConfirm(_ request: Binding<KBConfirmRequest?>) -> some View {
        alert(
            request.wrappedValue?.title ?? "",
            isPresented: Binding(
                get: { request.wrappedValue != nil },
                set: { if !$0 { request.wrappedValue = nil } }
            ),
            presenting: request.wrappedValue
        ) { pending in
            Button("Vazgeç", role: .cancel) { request.wrappedValue = nil }
            Button(pending.confirmTitle, role: pending.destructive ? .destructive : nil) {
                pending.action()
                request.wrappedValue = nil
            }
        } message: { pending in
            if let message = pending.message { Text(message) }
        }
    }
}
