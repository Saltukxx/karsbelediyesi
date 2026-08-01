import Foundation

/// Bildirim ve push'ların istediği ekran geçişlerini kabuğa iletir.
///
/// Kabuk (`MainShellView`) isteği görüp sekme/kenar çubuğu seçimini ve detay
/// yığınını kurar, sonra `tamamlandi()` ile temizler. Ayrı bir nesne olması,
/// bildirim listesinin kabuğun iç durumunu bilmesini gerektirmez.
@MainActor
final class AppNavigator: ObservableObject {
    @Published private(set) var istek: KBDeepLink?

    func ac(_ hedef: KBDeepLink) {
        istek = hedef
    }

    /// Kabuk isteği uyguladıktan sonra çağırır.
    func tamamlandi() {
        istek = nil
    }
}
