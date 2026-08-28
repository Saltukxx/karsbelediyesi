import SwiftUI

/// Mutasyon sonrası başarı geri bildirimi. Web panelindeki ToastProvider karşılığı.
struct KBToastModifier: ViewModifier {
    @Binding var message: String?

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if let message {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(KBTheme.success)
                        Text(message)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(KBTheme.navy)
                            .lineLimit(2)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(.regularMaterial)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(KBTheme.border, lineWidth: 1))
                    .shadow(color: KBTheme.navy.opacity(0.12), radius: 12, y: 4)
                    .padding(.bottom, 24)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: message) {
                        try? await Task.sleep(nanoseconds: 2_200_000_000)
                        self.message = nil
                    }
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: message)
    }
}

extension View {
    func kbToast(_ message: Binding<String?>) -> some View {
        modifier(KBToastModifier(message: message))
    }
}
