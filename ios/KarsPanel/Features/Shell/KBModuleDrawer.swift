import SwiftUI

/// Marka bandındaki hamburger düğmesinin açtığı modül menüsü.
///
/// Web'deki `MobileModuleMenu` ile aynı yapı: hızlı erişim ızgarası, gruplara göre
/// açılır bölümler ve kullanıcı bilgisiyle çıkış bandı. Sekme çubuğunun da üstünü
/// kapatması gerektiği için kabuk seviyesinde bir kaplama olarak çizilir.
struct KBModuleDrawer: View {
    @Binding var isPresented: Bool
    let items: [NavDestination]
    let favorites: [NavDestination]
    let active: NavDestination?
    var onSelect: (NavDestination) -> Void

    @EnvironmentObject private var session: AppSession
    @State private var acikGrup: NavGroupId?

    private static let panelWidth: CGFloat = 320

    private var gruplar: [(group: NavGroupId, items: [NavDestination])] {
        NavGroupId.allCases.compactMap { group in
            let liste = items.filter { $0.group == group && !favorites.contains($0) }
            return liste.isEmpty ? nil : (group, liste)
        }
    }

    var body: some View {
        ZStack(alignment: .leading) {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { kapat() }

            panel
                .frame(width: Self.panelWidth)
                .frame(maxHeight: .infinity)
                .background(KBTheme.background)
                .ignoresSafeArea(edges: .bottom)
                .transition(.move(edge: .leading))
        }
        .onAppear { acikGrup = active?.group ?? gruplar.first?.group }
    }

    private var panel: some View {
        VStack(spacing: 0) {
            baslik
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    girisMetni
                    if !favorites.isEmpty { hizliErisim }
                    gruplarBolumu
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 18)
            }
            .accessibilityIdentifier("modulMenusuListesi")
            altBant
        }
    }

    private var baslik: some View {
        HStack(spacing: 12) {
            BrandMarkView(light: true, compact: true)
            Text("Kars Belediyesi")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
            Spacer(minLength: 8)
            Button {
                kapat()
            } label: {
                Image(systemName: "xmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Menüyü kapat")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(KBTheme.navy.ignoresSafeArea(edges: .top))
    }

    private var girisMetni: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Modüller")
                .font(.title3.weight(.bold))
                .foregroundStyle(KBTheme.navy)
            Text("Çalışma alanınızı seçin.")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
        }
    }

    private var hizliErisim: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Hızlı Erişim", systemImage: "star.fill")
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(KBTheme.muted)
                .labelStyle(.titleAndIcon)

            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                spacing: 8
            ) {
                ForEach(favorites, id: \.self) { destination in
                    Button {
                        sec(destination)
                    } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            Image(systemName: destination.icon)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(KBTheme.accent)
                            Text(destination.label)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(KBTheme.navy)
                                .multilineTextAlignment(.leading)
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, minHeight: 76, alignment: .topLeading)
                        .padding(10)
                        .background(KBTheme.card)
                        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
                        .overlay(
                            RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                                .stroke(vurgulu(destination) ? KBTheme.accent : KBTheme.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var gruplarBolumu: some View {
        VStack(spacing: 8) {
            ForEach(gruplar, id: \.group) { grup in
                let acik = acikGrup == grup.group
                VStack(spacing: 0) {
                    Button {
                        withAnimation(.snappy(duration: 0.22)) {
                            acikGrup = acik ? nil : grup.group
                        }
                    } label: {
                        HStack {
                            Text(grup.group.label)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(KBTheme.navy)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(KBTheme.muted)
                                .rotationEffect(.degrees(acik ? 180 : 0))
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: KBTheme.touchMin)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(acik ? .isSelected : [])

                    if acik {
                        Divider().overlay(KBTheme.border)
                        VStack(spacing: 2) {
                            ForEach(grup.items, id: \.self) { destination in
                                satir(destination)
                            }
                        }
                        .padding(6)
                        .background(KBTheme.background)
                    }
                }
                .background(KBTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
                .overlay(
                    RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                        .stroke(KBTheme.border, lineWidth: 1)
                )
            }
        }
    }

    private func satir(_ destination: NavDestination) -> some View {
        let secili = vurgulu(destination)
        return Button {
            sec(destination)
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: destination.icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(KBTheme.navy)
                    .frame(width: 18)
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(destination.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KBTheme.navy)
                    Text(destination.summary)
                        .font(.caption2)
                        .foregroundStyle(KBTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .multilineTextAlignment(.leading)
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(secili ? KBTheme.card : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // Varsayılan davranışta etiket başlık ve açıklamayı birleştiriyor; modül adı
        // etiket, açıklama ipucu olarak ayrılır.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(destination.label)
        .accessibilityHint(destination.summary)
        .accessibilityAddTraits(secili ? [.isButton, .isSelected] : .isButton)
    }

    private var altBant: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let user = session.user {
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KBTheme.navy)
                    // Ad ile rol etiketi aynı olabiliyor; aynıysa satır tekrarlanmasın.
                    if user.role.label != user.name {
                        Text(user.role.label)
                            .font(.caption2)
                            .foregroundStyle(KBTheme.muted)
                    }
                }
            }
            Button {
                isPresented = false
                session.signOut()
            } label: {
                Label("Çıkış Yap", systemImage: "rectangle.portrait.and.arrow.right")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KBTheme.danger)
                    .frame(maxWidth: .infinity, minHeight: KBTheme.touchMin)
                    .background(KBTheme.card)
                    .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
                    .overlay(
                        RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                            .stroke(KBTheme.border, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(KBTheme.background)
        .overlay(alignment: .top) {
            Rectangle().fill(KBTheme.border).frame(height: 1)
        }
    }

    private func vurgulu(_ destination: NavDestination) -> Bool {
        active == destination
    }

    private func sec(_ destination: NavDestination) {
        kapat()
        onSelect(destination)
    }

    private func kapat() {
        withAnimation(.snappy(duration: 0.25)) { isPresented = false }
    }
}
