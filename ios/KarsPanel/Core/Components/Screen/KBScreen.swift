import SwiftUI

/// Panel ekranlarının ortak iskeleti: sayfa başlığı, hata bandı, yükleniyor ve boş durum
/// tek yerde çözülür. İçerik dikey bir yığın olarak verilir.
struct KBScreen<Content: View>: View {
    var title: String? = nil
    var description: String? = nil
    var action: KBHeaderAction? = nil
    var isLoading = false
    var errorMessage: String? = nil
    var isEmpty = false
    var empty: KBEmptyConfig? = nil
    var spacing: CGFloat = 12
    var refresh: (() async -> Void)? = nil
    @ViewBuilder var content: () -> Content

    var body: some View {
        if let refresh {
            scroll.refreshable { await refresh() }
        } else {
            scroll
        }
    }

    private var scroll: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: spacing) {
                if let title {
                    KBPageHeader(title: title, description: description, action: action)
                }

                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                }

                // İçerik boş durumda da çizilir: arama, filtre çipleri ve sekmeler
                // kaybolursa kullanıcı filtreyi geri alamaz.
                content()

                // Hata bandı varken "kayıt yok" kartı yanıltıcı olur.
                if isEmpty && errorMessage == nil {
                    emptyView
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 24)
        }
        .kbScreenBackground()
        // Başlık zaten KBPageHeader'da; gezinme çubuğu sadece geri düğmesi için var.
        .kbNavigationChrome()
        .overlay {
            if isLoading && isEmpty { LoadingOverlay() }
        }
    }

    @ViewBuilder
    private var emptyView: some View {
        if !isLoading {
            let config = empty ?? KBEmptyConfig()
            EmptyStateView(
                title: config.title,
                systemImage: config.systemImage,
                message: config.message,
                actionTitle: config.actionTitle,
                action: config.action
            )
            .kbCard()
        }
    }
}

struct KBEmptyConfig {
    var title = "Kayıt bulunamadı"
    var systemImage = "tray"
    var message: String? = "Bu ekranda gösterilecek kayıt yok. Aşağı çekerek yenileyin."
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil
}
