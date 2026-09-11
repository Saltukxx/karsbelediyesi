import SwiftUI

/// Uygulamanın üst marka bandı. Kabuk seviyesinde bir kez çizilir; böylece hem sekme
/// kökleri hem de push edilen ekranlar aynı navy başlığı paylaşır.
///
/// Gezinme yığınının dışında durduğu için arama ve hesap eylemleri `NavigationLink`
/// yerine sheet ile açılır.
struct KBBrandHeader: View {
    /// Modül menüsünü açar. Menü sekme çubuğunun da üstünü kapatması gerektiği için
    /// kabuk seviyesinde çizilir; başlık yalnızca tetikler.
    var onMenu: (() -> Void)? = nil

    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var offlineQueue: OfflineMutationQueue
    @State private var showSearch = false

    var body: some View {
        // Düğmeler 44pt dokunma alanı taşıdığı için yığın aralığı dar tutulur;
        // aksi halde dört kontrol marka metnini kırpıyor.
        HStack(spacing: 4) {
            if let onMenu {
                Button(action: onMenu) {
                    Image(systemName: "line.3.horizontal")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Modüller menüsü")
            }

            BrandMarkView(light: true, compact: true)
            VStack(alignment: .leading, spacing: 2) {
                Text("Kars Belediyesi")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text("Şehir Operasyon Sistemi")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.72))
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.leading, 4)
            Spacer(minLength: 4)

            if offlineQueue.pendingCount > 0 {
                Text("Senkron bekliyor (\(offlineQueue.pendingCount))")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.9))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(KBTheme.warning.opacity(0.95), in: Capsule())
                    .accessibilityLabel("Senkron bekliyor, \(offlineQueue.pendingCount) işlem")
                    .onTapGesture {
                        Task { await OfflineMutationQueue.shared.flush() }
                    }
            }

            Button {
                showSearch = true
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Arama")

            NotificationBellView()
                .foregroundStyle(.white)
                .tint(.white)

            Menu {
                if let user = session.user {
                    Text(user.name)
                    Text(user.role.label)
                    Divider()
                }
                LocationShareMenuItem()
                Button("Arama") { showSearch = true }
                Button("Çıkış Yap", role: .destructive) {
                    session.signOut()
                }
            } label: {
                Image(systemName: "person.crop.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.white)
                    .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
            }
            .accessibilityLabel("Hesap menüsü")
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 10)
        .background(KBTheme.navy.ignoresSafeArea(edges: .top))
        .sheet(isPresented: $showSearch) {
            NavigationStack {
                SearchPaletteView()
            }
        }
    }
}
