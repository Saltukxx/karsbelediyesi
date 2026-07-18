import SwiftUI

enum KBTheme {
    static let navy = Color(red: 0x1e / 255, green: 0x3a / 255, blue: 0x5f / 255)
    static let navyDeep = Color(red: 0x15 / 255, green: 0x2a / 255, blue: 0x45 / 255)
    static let accent = Color(red: 0xc4 / 255, green: 0x5c / 255, blue: 0x26 / 255)
    static let background = Color(red: 0xf4 / 255, green: 0xf6 / 255, blue: 0xf9 / 255)
    static let card = Color.white
    static let muted = Color(red: 0x6b / 255, green: 0x72 / 255, blue: 0x80 / 255)
    static let border = Color(red: 0xe2 / 255, green: 0xe8 / 255, blue: 0xf0 / 255)
    static let danger = Color(red: 0xb9 / 255, green: 0x1c / 255, blue: 0x1c / 255)
    static let success = Color(red: 0x16 / 255, green: 0x7a / 255, blue: 0x45 / 255)
    static let warning = Color(red: 0xb4 / 255, green: 0x53 / 255, blue: 0x09 / 255)
    static let info = Color(red: 0x1d / 255, green: 0x4e / 255, blue: 0xd8 / 255)

    static let radiusSm: CGFloat = 10
    static let radiusMd: CGFloat = 14
    static let touchMin: CGFloat = 44
}

struct KBPrimaryButtonStyle: ButtonStyle {
    var filled = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(filled ? .white : KBTheme.navy)
            .frame(maxWidth: .infinity)
            .frame(minHeight: KBTheme.touchMin)
            .padding(.horizontal, 16)
            .background(
                filled
                    ? KBTheme.navy.opacity(configuration.isPressed ? 0.85 : 1)
                    : Color.clear
            )
            .overlay(
                RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                    .stroke(KBTheme.navy.opacity(filled ? 0 : 1), lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct KBCardModifier: ViewModifier {
    var padded = true

    func body(content: Content) -> some View {
        content
            .padding(padded ? 16 : 0)
            .background(KBTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
            .overlay(
                RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                    .stroke(KBTheme.border, lineWidth: 1)
            )
            .shadow(color: KBTheme.navy.opacity(0.04), radius: 8, y: 2)
    }
}

extension View {
    func kbCard(padded: Bool = true) -> some View {
        modifier(KBCardModifier(padded: padded))
    }

    func kbScreenBackground() -> some View {
        background(KBTheme.background.ignoresSafeArea())
    }

    @ViewBuilder
    func hideScrollBackgroundIfAvailable() -> some View {
        if #available(iOS 16.0, *) {
            self.scrollContentBackground(.hidden)
        } else {
            self
        }
    }
}
