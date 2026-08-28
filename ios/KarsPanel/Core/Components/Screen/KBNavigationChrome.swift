import SwiftUI

private struct KBRootScreenKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// Sekme kökünde açılan ekranlar için true. Kök ekranlarda marka bandı zaten üstte
    /// durduğundan sistem gezinme çubuğu gizlenir; push edilen ekranlarda geri düğmesi kalır.
    var kbIsRootScreen: Bool {
        get { self[KBRootScreenKey.self] }
        set { self[KBRootScreenKey.self] = newValue }
    }
}

private struct KBNavigationChromeModifier: ViewModifier {
    @Environment(\.kbIsRootScreen) private var isRoot
    let title: String?

    func body(content: Content) -> some View {
        content
            .navigationTitle(title ?? "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(isRoot ? .hidden : .visible, for: .navigationBar)
    }
}

extension View {
    func kbNavigationChrome(title: String? = nil) -> some View {
        modifier(KBNavigationChromeModifier(title: title))
    }
}
