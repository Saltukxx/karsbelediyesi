import SwiftUI

/// `/denetim` — panel ve API üzerinden yapılan işlemlerin kaydı.
/// Filtreler ve sayfalama web sayfasıyla aynı kurallarla çalışır.
struct DenetimView: View {
    @StateObject private var viewModel = DenetimViewModel()
    @State private var filtreAcik = false

    var body: some View {
        List {
            if let error = viewModel.errorMessage {
                Section { ErrorBanner(message: error) }
            }

            if viewModel.filtreliMi {
                Section { aktifFiltreOzeti }
            }

            if viewModel.kayitlar.isEmpty, !viewModel.isLoading {
                Section {
                    EmptyStateView(
                        title: "Denetim kaydı yok",
                        systemImage: "checkmark.shield",
                        message: """
                        Filtreleri değiştirin veya işlemler yapıldıkça kayıtlar \
                        burada görünecek.
                        """
                    )
                }
            } else {
                Section {
                    ForEach(viewModel.kayitlar) { kayit in
                        DenetimSatiri(kayit: kayit)
                    }
                } header: {
                    Text("\(viewModel.toplam) kayıt")
                } footer: {
                    if viewModel.toplamSayfa > 1 {
                        Text("Sayfa \(viewModel.page) / \(viewModel.toplamSayfa)")
                    }
                }

                if viewModel.toplamSayfa > 1 {
                    Section { sayfalama }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(NavDestination.denetim.label)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    filtreAcik = true
                } label: {
                    Label(
                        "Filtrele",
                        systemImage: viewModel.filtreliMi
                            ? "line.3.horizontal.decrease.circle.fill"
                            : "line.3.horizontal.decrease.circle"
                    )
                }
            }
        }
        .overlay {
            if viewModel.isLoading, viewModel.kayitlar.isEmpty { LoadingOverlay() }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .sheet(isPresented: $filtreAcik) {
            NavigationStack {
                DenetimFiltreView(viewModel: viewModel)
            }
        }
    }

    private var aktifFiltreOzeti: some View {
        HStack {
            Label(viewModel.filtreOzeti, systemImage: "line.3.horizontal.decrease")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
            Spacer(minLength: 8)
            Button("Temizle") {
                Task { await viewModel.filtreleriTemizle() }
            }
            .font(.caption.bold())
        }
    }

    private var sayfalama: some View {
        HStack {
            Button {
                Task { await viewModel.oncekiSayfa() }
            } label: {
                Label("Önceki", systemImage: "chevron.left")
            }
            .disabled(viewModel.page <= 1 || viewModel.isLoading)

            Spacer()

            Button {
                Task { await viewModel.sonrakiSayfa() }
            } label: {
                Label("Sonraki", systemImage: "chevron.right")
                    .labelStyle(.titleAndIcon)
            }
            .disabled(viewModel.page >= viewModel.toplamSayfa || viewModel.isLoading)
        }
        .font(.subheadline)
    }
}

private struct DenetimSatiri: View {
    let kayit: DenetimKaydiDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(kayit.islemEtiketi)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(KBTheme.navy)
                Spacer(minLength: 0)
                Text(kayit.zaman.formatted(date: .numeric, time: .standard))
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }

            HStack(spacing: 6) {
                Text(kayit.userAd)
                    .font(.caption)
                StatusBadge(text: kayit.rolEtiketi, tone: .neutral)
            }

            Text(kayit.varlikMetni)
                .font(.caption2.monospaced())
                .foregroundStyle(KBTheme.muted)

            if let detay = kayit.detayMetni {
                Text(detay)
                    .font(.caption2.monospaced())
                    .foregroundStyle(KBTheme.muted)
                    .lineLimit(3)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Filtre sayfası

private struct DenetimFiltreView: View {
    @ObservedObject var viewModel: DenetimViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var kullanici = ""
    @State private var islem: String?
    @State private var varlik: String?
    @State private var baslangic: Date?
    @State private var bitis: Date?

    var body: some View {
        Form {
            Section {
                KBTextField(
                    title: "Kullanıcı",
                    text: $kullanici,
                    placeholder: "Kullanıcı adı...",
                    capitalization: .words
                )
            }

            Section {
                KBPickerField(
                    title: "İşlem",
                    items: viewModel.islemSecenekleri,
                    selection: $islem,
                    placeholder: "Tüm İşlemler"
                ) { DenetimIslemi.etiket($0.id) }

                KBPickerField(
                    title: "Varlık",
                    items: viewModel.varlikSecenekleri,
                    selection: $varlik,
                    placeholder: "Tüm Varlıklar"
                ) { $0.id }
            }

            Section {
                KBDateField(title: "Başlangıç", date: $baslangic)
                KBDateField(title: "Bitiş", date: $bitis)
            } footer: {
                Text("Bitiş tarihi gün sonuna kadar dahil edilir.")
            }

            Section {
                Button("Filtrele") {
                    Task {
                        await viewModel.filtreUygula(
                            kullanici: kullanici,
                            islem: islem,
                            varlik: varlik,
                            baslangic: baslangic,
                            bitis: bitis
                        )
                        dismiss()
                    }
                }
                .buttonStyle(KBPrimaryButtonStyle())

                Button("Filtreleri temizle") {
                    Task {
                        await viewModel.filtreleriTemizle()
                        dismiss()
                    }
                }
                .buttonStyle(KBPrimaryButtonStyle(filled: false))
            }
        }
        .navigationTitle("Denetim Filtresi")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            kullanici = viewModel.kullaniciFiltresi
            islem = viewModel.islemFiltresi
            varlik = viewModel.varlikFiltresi
            baslangic = viewModel.baslangicFiltresi
            bitis = viewModel.bitisFiltresi
        }
    }
}
