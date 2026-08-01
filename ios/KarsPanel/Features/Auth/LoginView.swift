import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: AppSession
    @Environment(\.horizontalSizeClass) private var sizeClass
    @StateObject private var viewModel = LoginViewModel()
    @FocusState private var focusedField: Field?
    @State private var showingServerSettings = false

    private enum Field { case phone, password }

    /// iPad'de kart tüm genişliğe yayılmasın; okunur bir sütun genişliğinde kalıp
    /// başlığın altındaki boşlukta dikeyde ortalanır.
    private var genisEkran: Bool { sizeClass == .regular }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    heroHeader(
                        height: max(180, geo.size.height * (genisEkran ? 0.22 : 0.28))
                    )

                    if genisEkran { Spacer(minLength: 24) }

                    girisKarti
                        .frame(maxWidth: 460)
                        .padding(.horizontal, 16)
                        // Telefonda kart başlık şeridinin üstüne biner; iPad'de
                        // ortalandığı için bindirmeye gerek kalmaz.
                        .offset(y: genisEkran ? 0 : -28)

                    Spacer(minLength: genisEkran ? 24 : 40)
                    // Geniş ekranda alt boşluk üstün iki katı esner: kart tam
                    // ortada değil, giriş formlarında alışıldık olan optik
                    // merkezde durur.
                    if genisEkran { Spacer(minLength: 0) }
                }
                .frame(maxWidth: .infinity)
                .frame(minHeight: geo.size.height)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(
            LinearGradient(
                colors: [KBTheme.navyDeep, KBTheme.background],
                startPoint: .top,
                endPoint: .center
            )
            .ignoresSafeArea()
        )
        .overlay {
            if viewModel.isLoading { LoadingOverlay() }
        }
        .sheet(isPresented: $showingServerSettings) {
            ServerSettingsView()
        }
    }

    private var girisKarti: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Panel Girişi")
                    .font(.title2.bold())
                    .foregroundStyle(KBTheme.navy)
                Text("Telefon numaranız ve şifrenizle oturum açın.")
                    .font(.subheadline)
                    .foregroundStyle(KBTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(alignment: .leading, spacing: 8) {
                FormFieldLabel(title: "Telefon", required: true)
                TextField("05xxxxxxxxx", text: $viewModel.phone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .focused($focusedField, equals: .phone)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }
                    .kbTextField()
            }

            VStack(alignment: .leading, spacing: 8) {
                FormFieldLabel(title: "Şifre", required: true)
                SecureField("••••••••", text: $viewModel.password)
                    .textContentType(.password)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit {
                        Task { await viewModel.submit(session: session) }
                    }
                    .kbTextField()
            }

            if let expired = session.sessionExpiredMessage {
                ErrorBanner(message: expired)
            }

            if let error = viewModel.errorMessage {
                ErrorBanner(message: error)
            }

            Button {
                focusedField = nil
                Task { await viewModel.submit(session: session) }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Giriş Yap")
                }
            }
            .buttonStyle(KBPrimaryButtonStyle())
            .disabled(!viewModel.canSubmit || viewModel.isLoading)
            .opacity(viewModel.canSubmit ? 1 : 0.55)

            Button {
                showingServerSettings = true
            } label: {
                Label(
                    session.baseURL.host ?? "Sunucu ayarları",
                    systemImage: "server.rack"
                )
                .font(.footnote)
            }
            .foregroundStyle(KBTheme.muted)
            .frame(maxWidth: .infinity)
        }
        .padding(20)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: KBTheme.navy.opacity(0.08), radius: 16, y: 6)
    }

    private func heroHeader(height: CGFloat) -> some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [KBTheme.navyDeep, KBTheme.navy],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Circle()
                .fill(Color.white.opacity(0.06))
                .frame(width: 180, height: 180)
                .offset(x: 220, y: -40)

            VStack(alignment: .leading, spacing: 12) {
                BrandMarkView(light: true)
                Text("Belediye operasyonlarını\ntek panelden yönetin.")
                    .font(.subheadline)
                    .foregroundStyle(Color.white.opacity(0.8))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 48)
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
    }
}

private extension View {
    func kbTextField() -> some View {
        self
            .padding(.horizontal, 14)
            .frame(minHeight: KBTheme.touchMin)
            .background(KBTheme.background)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
            .overlay(
                RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                    .stroke(KBTheme.border, lineWidth: 1)
            )
    }
}
