import SwiftUI

/// Tam ekran harita kullanan ekranların başlık şeridi.
///
/// Kit ekranları başlığını `KBPageHeader` ile içerikte çizer; haritalar bunu
/// yapamaz çünkü `KBScreen` kaydırma yığını kullanır. Sistem gezinme çubuğu da
/// sekme köklerinde gizli olduğundan (`kbNavigationChrome`), harita ekranları
/// başlıksız kalıyordu. Bu şerit aynı görsel dili haritanın üstünde ince bir
/// bantla verir.
struct KBMapHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.headline)
                .foregroundStyle(KBTheme.navy)
            if let subtitle {
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(KBTheme.card)
        .overlay(alignment: .bottom) {
            Rectangle().fill(KBTheme.border).frame(height: 1)
        }
    }
}
