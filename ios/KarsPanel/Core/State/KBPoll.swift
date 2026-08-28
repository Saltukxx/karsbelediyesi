import SwiftUI

enum KBPoll {
    /// Yoklama aralığına uygulanan rastgele sapma oranı.
    ///
    /// Sabit aralıkla yoklayan istemciler bir kez aynı anda açıldığında (mesai
    /// başlangıcı gibi) sonsuza dek aynı saniyede istek atmaya devam eder ve
    /// sunucuda düzenli tepe oluşturur. Her turda aralığı rastgele kaydırmak
    /// istemcileri birbirinden ayırır; ölçümde tepe yükün asıl kaynağı buydu.
    static let sapma: ClosedRange<Double> = 0.75...1.25

    static func jitterliAralik(_ saniye: Double) -> Double {
        saniye * Double.random(in: sapma)
    }
}

private struct KBPollModifier: ViewModifier {
    let aralik: Double
    let islem: () async -> Void

    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        // scenePhase'e bağlanan görev, uygulama arka plana alındığında iptal
        // edilir; öne döndüğünde yeni bir rastgele sapmayla baştan başlar.
        content.task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                let bekleme = KBPoll.jitterliAralik(aralik)
                try? await Task.sleep(for: .seconds(bekleme))
                if Task.isCancelled { return }
                await islem()
            }
        }
    }
}

extension View {
    /// Uygulama önplandayken `islem`'i yaklaşık `aralik` saniyede bir çalıştırır.
    ///
    /// İlk yükleme bu kapsamda değildir; ekran açılırken veriyi `.task` ile
    /// hemen çekin, tazelemeyi buna bırakın.
    func kbPoll(every aralik: Double, islem: @escaping () async -> Void) -> some View {
        modifier(KBPollModifier(aralik: aralik, islem: islem))
    }
}
