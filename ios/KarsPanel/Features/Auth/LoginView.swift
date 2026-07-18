import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var viewModel = LoginViewModel()
    @FocusState private var focusedField: Field?

    private enum Field { case phone, password }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    heroHeader(height: max(180, geo.size.height * 0.28))

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
                    }
                    .padding(20)
                    .background(KBTheme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .shadow(color: KBTheme.navy.opacity(0.08), radius: 16, y: 6)
                    .padding(.horizontal, 16)
                    .offset(y: -28)

                    Spacer(minLength: 40)
                }
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
