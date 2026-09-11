import AVFoundation
import SwiftUI

/// WhatsApp ses medyası için minimal oynatıcı. Sheet kapanınca durur.
struct KBAudioPlayerView: View {
    let fileURL: URL

    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var endObserver: NSObjectProtocol?

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "waveform.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(KBTheme.accent)
                .accessibilityHidden(true)

            Text("Ses kaydı")
                .font(.headline)
                .foregroundStyle(KBTheme.navy)

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
        .padding(24)
        .onAppear { prepare() }
        .onDisappear { teardown() }
    }

    private func prepare() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Oturum açılamazsa AVPlayer yine de deneyebilir
        }
        let item = AVPlayerItem(url: fileURL)
        let p = AVPlayer(playerItem: item)
        player = p
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
        guard let player else { return }
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
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
