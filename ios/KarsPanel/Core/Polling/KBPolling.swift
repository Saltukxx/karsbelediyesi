import Foundation

/// Uygulamanın canlı veri yenileme aralıkları tek yerde toplanır; web
/// panelindeki `setInterval` süreleriyle birebir aynıdır.
enum KBPollingChannel: String, CaseIterable {
    /// Komuta ekranı — `KomutaClient.tsx`
    case komuta
    /// WhatsApp kuyruğu — `WhatsAppQueueLive.tsx`
    case whatsapp
    /// Bildirim zili — `NotificationBell.tsx`
    case bildirim

    var interval: TimeInterval {
        switch self {
        case .komuta: return 30
        case .whatsapp: return 15
        case .bildirim: return 30
        }
    }
}

/// SwiftUI `ScenePhase`'in UI'dan bağımsız karşılığı; politika testleri bunu
/// kullanır.
enum KBAppPhase {
    case active
    case inactive
    case background
}

enum KBPollingPolicy {
    /// Yenileme yalnızca uygulama ön plandayken ve ilgili ekran görünürken
    /// çalışır. Arka planda hem pil hem de gereksiz sunucu yükü olur; iOS
    /// zaten uzun süre çalışmasına izin vermez.
    static func calismali(phase: KBAppPhase, ekranGorunur: Bool) -> Bool {
        phase == .active && ekranGorunur
    }
}

/// Belirli aralıklarla verilen işi tekrarlayan hafif zamanlayıcı.
///
/// `Timer` yerine `Task` kullanılır: iş async'tir ve bir tur bitmeden yenisi
/// başlamaz, böylece yavaş ağda istekler üst üste binmez.
///
/// Çalışan döngü verilen kapamayı (dolayısıyla sahibini) canlı tutar; ekranlar
/// `sync(phase:ekranGorunur:action:)` çağırarak kaybolduklarında durdurmalıdır.
@MainActor
final class KBPoller {
    private let channel: KBPollingChannel
    private var task: Task<Void, Never>?

    init(channel: KBPollingChannel) {
        self.channel = channel
    }

    var isRunning: Bool { task != nil }

    /// Çalışıyorsa yeniden başlatmaz; ilk turu beklemeden tetikler.
    func start(_ action: @escaping @MainActor () async -> Void) {
        guard task == nil else { return }
        let interval = channel.interval
        task = Task { @MainActor in
            while !Task.isCancelled {
                await action()
                do {
                    try await Task.sleep(for: .seconds(interval))
                } catch {
                    return
                }
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }

    /// Sahne durumu / ekran görünürlüğü değiştiğinde tek çağrıyla eşitlenir.
    func sync(
        phase: KBAppPhase,
        ekranGorunur: Bool,
        action: @escaping @MainActor () async -> Void
    ) {
        if KBPollingPolicy.calismali(phase: phase, ekranGorunur: ekranGorunur) {
            start(action)
        } else {
            stop()
        }
    }
}
