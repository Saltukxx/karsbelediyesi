import AVFoundation
import SwiftUI

/// WhatsApp ses medyası için minimal oynatıcı. Opus/OGG gibi desteklenmeyen
/// formatlarda sessiz fail yerine Türkçe yedek (indir / açılamıyor) gösterir.
struct KBAudioPlayerView: View {
    let fileURL: URL

    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var endObserver: NSObjectProtocol?
    @State private var statusObserver: NSKeyValueObservation?
    @State private var unsupportedMessage: String?
    @State private var showShare = false

    private var isLikelyOpusOgg: Bool {
        let ext = fileURL.pathExtension.lowercased()
        if ext == "ogg" || ext == "opus" { return true }
        guard let fh = try? FileHandle(forReadingFrom: fileURL) else { return false }
        defer { try? fh.close() }
        let head = fh.readData(ofLength: 4)
        guard head.count >= 4 else { return false }
        let b = [UInt8](head)
        return b[0] == 0x4F && b[1] == 0x67 && b[2] == 0x67 && b[3] == 0x53
    }

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: unsupportedMessage == nil ? "waveform.circle.fill" : "exclamationmark.triangle.fill")
                .font(.system(size: 64))
                .foregroundStyle(unsupportedMessage == nil ? KBTheme.accent : KBTheme.danger)
                .accessibilityHidden(true)

            Text(unsupportedMessage == nil ? "Ses kaydı" : "Ses açılamıyor")
                .font(.headline)
                .foregroundStyle(KBTheme.navy)

            if let unsupportedMessage {
                Text(unsupportedMessage)
                    .font(.subheadline)
                    .foregroundStyle(KBTheme.muted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Button {
                    showShare = true
                } label: {
                    Label("İndir / Paylaş", systemImage: "square.and.arrow.up")
                        .font(.title3.weight(.semibold))
                        .frame(minHeight: KBTheme.touchMin)
                }
                .buttonStyle(.borderedProminent)
                .tint(KBTheme.navy)
            } else {
                Button {
                    toggle()
                } label: {
                    Label(
                        isPlaying ? "Duraklat" : "Oynat",
                        systemImage: isPlaying ? "pause.circle.fill" : "play.circle.fill"
                    )
                    .font(.title3.weight(.semibold))
                    .frame(minHeight: KBTheme.touchMin)
                }
                .buttonStyle(.borderedProminent)
                .tint(KBTheme.navy)
            }
        }
        .padding(24)
        .onAppear { prepare() }
        .onDisappear { teardown() }
        .sheet(isPresented: $showShare) {
            ShareSheet(items: [fileURL])
        }
    }

    private func prepare() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Oturum açılamazsa AVPlayer yine de deneyebilir
        }

        // iOS AVPlayer Opus/OGG'yi çoğu cihazda açamaz; dönüşüm trivial değil → yedek.
        if isLikelyOpusOgg {
            unsupportedMessage =
                "Bu WhatsApp sesi Opus/OGG formatında; cihazda doğrudan açılamıyor. İndirip başka bir uygulamada dinleyebilirsiniz."
            return
        }

        let item = AVPlayerItem(url: fileURL)
        let p = AVPlayer(playerItem: item)
        player = p
        statusObserver = item.observe(\.status, options: [.new]) { item, _ in
            DispatchQueue.main.async {
                if item.status == .failed {
                    unsupportedMessage =
                        "Ses dosyası oynatılamıyor. İndirip başka bir uygulamada açmayı deneyin."
                    isPlaying = false
                }
            }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { _ in
            isPlaying = false
            p.seek(to: .zero)
        }
    }

    private func toggle() {
        guard let player, unsupportedMessage == nil else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
        }
    }

    private func teardown() {
        player?.pause()
        player = nil
        isPlaying = false
        statusObserver?.invalidate()
        statusObserver = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
