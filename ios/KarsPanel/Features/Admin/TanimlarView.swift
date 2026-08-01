import SwiftUI

/// `/tanimlar` — mahalle, müdürlük, şikayet türü, araç cinsi, kullanıcı/rol ve
/// akıllı dispatch anahtarı. Web sayfasındaki altı bölümün birebir karşılığı.
struct TanimlarView: View {
    @StateObject private var viewModel = TanimlarViewModel()
    @State private var yeniMahalle = ""
    @State private var yeniAracCinsi = ""
    @State private var mudurlukFormu: MudurlukFormHedefi?
    @State private var sikayetTuruFormu: SikayetTuruFormHedefi?
    @State private var kullaniciFormu: KullaniciFormHedefi?

    var body: some View {
        List {
            if let error = viewModel.errorMessage {
                Section { ErrorBanner(message: error) }
            }
            if let bilgi = viewModel.bilgiMesaji {
                Section {
                    Label(bilgi, systemImage: "checkmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(KBTheme.success)
                }
            }

            dispatchBolumu
            mahalleBolumu
            mudurlukBolumu
            sikayetTuruBolumu
            aracCinsiBolumu
            kullaniciBolumu
        }
        .listStyle(.insetGrouped)
        .navigationTitle(NavDestination.tanimlar.label)
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if viewModel.isLoading, viewModel.veri == nil { LoadingOverlay() }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .sheet(item: $mudurlukFormu) { hedef in
            NavigationStack {
                MudurlukFormView(hedef: hedef, viewModel: viewModel)
            }
        }
        .sheet(item: $sikayetTuruFormu) { hedef in
            NavigationStack {
                SikayetTuruFormView(hedef: hedef, viewModel: viewModel)
            }
        }
        .sheet(item: $kullaniciFormu) { hedef in
            NavigationStack {
                KullaniciFormView(hedef: hedef, viewModel: viewModel)
            }
        }
    }

    // MARK: - Akıllı dispatch

    private var dispatchBolumu: some View {
        Section {
            Toggle(
                "Tam otomatik atama",
                isOn: Binding(
                    get: { viewModel.otomatikAtama },
                    set: { yeni in
                        Task { await viewModel.otomatikAtamaKaydet(yeni) }
                    }
                )
            )
            .disabled(viewModel.islemYapiliyor || viewModel.veri == nil)

            Text(
                """
                Açıkken geciken kış / çöp rotaları için en yakın müsait araç \
                öneri beklenmeden göreve atanır. Kapalıyken öneriler Kış ve Çöp \
                ekranlarındaki "Bekleyen görevler" panelinde onay bekler.
                """
            )
            .font(.caption)
            .foregroundStyle(KBTheme.muted)
        } header: {
            Text("Akıllı Dispatch")
        }
    }

    // MARK: - Mahalleler

    private var mahalleBolumu: some View {
        Section {
            EkleSatiri(
                placeholder: "Yeni mahalle",
                text: $yeniMahalle,
                isSaving: viewModel.islemYapiliyor
            ) {
                let ad = yeniMahalle
                Task {
                    if await viewModel.mahalleEkle(ad) { yeniMahalle = "" }
                }
            }

            if viewModel.mahalleler.isEmpty {
                Text("Kayıtlı mahalle yok")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            } else {
                EtiketBulutu(
                    ogeler: viewModel.mahalleler.map {
                        ($0.id, $0.name, $0.aktif)
                    }
                )
            }
        } header: {
            Text("Mahalleler (\(viewModel.mahalleler.count))")
        }
    }

    // MARK: - Müdürlükler

    private var mudurlukBolumu: some View {
        Section {
            ForEach(viewModel.mudurlukler) { m in
                Button {
                    mudurlukFormu = .duzenle(m)
                } label: {
                    SatirIcerigi(
                        baslik: m.name,
                        altBaslik: m.shortName.isEmpty ? nil : m.shortName,
                        aktif: m.aktif
                    )
                }
                .buttonStyle(.plain)
            }
        } header: {
            BolumBasligi(baslik: "Müdürlükler", eylem: "+ Müdürlük") {
                mudurlukFormu = .yeni
            }
        }
    }

    // MARK: - Şikayet türleri

    private var sikayetTuruBolumu: some View {
        Section {
            ForEach(viewModel.sikayetTurleri) { t in
                Button {
                    sikayetTuruFormu = .duzenle(t)
                } label: {
                    SatirIcerigi(
                        baslik: t.name,
                        altBaslik: viewModel.mudurlukAdi(t.defaultDepartmentId)
                            ?? "Müdürlük atanmamış",
                        aktif: t.aktif
                    )
                }
                .buttonStyle(.plain)
            }
        } header: {
            BolumBasligi(baslik: "Şikayet Türleri → Müdürlük", eylem: "+ Tür") {
                sikayetTuruFormu = .yeni
            }
        }
    }

    // MARK: - Araç cinsleri

    private var aracCinsiBolumu: some View {
        Section {
            EkleSatiri(
                placeholder: "Yeni araç cinsi",
                text: $yeniAracCinsi,
                isSaving: viewModel.islemYapiliyor
            ) {
                let ad = yeniAracCinsi
                Task {
                    if await viewModel.aracCinsiEkle(ad) { yeniAracCinsi = "" }
                }
            }

            if viewModel.aracCinsleri.isEmpty {
                Text("Kayıtlı araç cinsi yok")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            } else {
                EtiketBulutu(
                    ogeler: viewModel.aracCinsleri.map { ($0.id, $0.name, $0.aktif) }
                )
            }
        } header: {
            Text("Araç Cinsleri")
        }
    }

    // MARK: - Kullanıcılar

    private var kullaniciBolumu: some View {
        Section {
            ForEach(viewModel.kullanicilar) { k in
                Button {
                    kullaniciFormu = .duzenle(k)
                } label: {
                    KullaniciSatiri(
                        kullanici: k,
                        mudurluk: viewModel.mudurlukAdi(k.departmentId)
                    )
                }
                .buttonStyle(.plain)
            }
        } header: {
            BolumBasligi(baslik: "Kullanıcılar & Roller", eylem: "+ Kullanıcı") {
                kullaniciFormu = .yeni
            }
        }
    }
}

// MARK: - Ortak parçalar

/// Tek metin alanı + ekle düğmesi (mahalle ve araç cinsi bölümleri).
private struct EkleSatiri: View {
    let placeholder: String
    @Binding var text: String
    let isSaving: Bool
    let onAdd: () -> Void

    private var gecerli: Bool {
        !text.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        HStack(spacing: 10) {
            TextField(placeholder, text: $text)
                .submitLabel(.done)
                .onSubmit { if gecerli { onAdd() } }
            Button("Ekle", action: onAdd)
                .buttonStyle(.borderedProminent)
                .disabled(!gecerli || isSaving)
        }
        .frame(minHeight: KBTheme.touchMin)
    }
}

/// Pasif kayıtlar web'de kırmızı görünür; aynı ayrımı burada da koruyoruz.
private struct EtiketBulutu: View {
    let ogeler: [(id: String, ad: String, aktif: Bool)]

    var body: some View {
        FlexibleTags(ogeler: ogeler) { oge in
            Text(oge.ad)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    (oge.aktif ? KBTheme.navy : KBTheme.danger).opacity(0.1),
                    in: Capsule()
                )
                .foregroundStyle(oge.aktif ? KBTheme.navy : KBTheme.danger)
        }
    }
}

private struct BolumBasligi: View {
    let baslik: String
    let eylem: String
    let action: () -> Void

    var body: some View {
        HStack {
            Text(baslik)
            Spacer()
            Button(eylem, action: action)
                .font(.caption.bold())
                .textCase(nil)
        }
    }
}

private struct SatirIcerigi: View {
    let baslik: String
    let altBaslik: String?
    let aktif: Bool

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(baslik)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(KBTheme.navy)
                if let altBaslik {
                    Text(altBaslik)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
            }
            Spacer(minLength: 0)
            if !aktif {
                StatusBadge(text: "Pasif", tone: .danger)
            }
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
        }
        .frame(minHeight: KBTheme.touchMin)
    }
}

private struct KullaniciSatiri: View {
    let kullanici: PanelKullaniciDTO
    let mudurluk: String?

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(kullanici.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(KBTheme.navy)
                Text(kullanici.phone)
                    .font(.caption.monospaced())
                    .foregroundStyle(KBTheme.muted)
                HStack(spacing: 6) {
                    StatusBadge(text: kullanici.role.label, tone: .info)
                    if let mudurluk {
                        Text(mudurluk)
                            .font(.caption2)
                            .foregroundStyle(KBTheme.muted)
                    }
                }
                if let son = kullanici.lastLoginAt {
                    Text("Son giriş: \(son.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption2)
                        .foregroundStyle(KBTheme.muted)
                } else {
                    Text("Hiç giriş yapmadı")
                        .font(.caption2)
                        .foregroundStyle(KBTheme.muted)
                }
            }
            Spacer(minLength: 0)
            if !kullanici.aktif {
                StatusBadge(text: "Pasif", tone: .danger)
            }
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
        }
        .frame(minHeight: KBTheme.touchMin)
    }
}

/// Etiketleri kullanılabilir genişliğe göre satırlara sarmalar.
private struct FlexibleTags<Icerik: View>: View {
    let ogeler: [(id: String, ad: String, aktif: Bool)]
    @ViewBuilder let icerik: ((id: String, ad: String, aktif: Bool)) -> Icerik

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) { ForEach(ogeler, id: \.id) { icerik($0) } }
            VStack(alignment: .leading, spacing: 6) {
                ForEach(satirlar(), id: \.first?.id) { satir in
                    HStack(spacing: 6) {
                        ForEach(satir, id: \.id) { icerik($0) }
                    }
                }
            }
        }
    }

    /// Kaba bir sarmalama: karakter uzunluğuna göre satır başına öğe toplar.
    private func satirlar() -> [[(id: String, ad: String, aktif: Bool)]] {
        var sonuc: [[(id: String, ad: String, aktif: Bool)]] = []
        var mevcut: [(id: String, ad: String, aktif: Bool)] = []
        var uzunluk = 0
        for oge in ogeler {
            let ek = oge.ad.count + 3
            if uzunluk + ek > 34, !mevcut.isEmpty {
                sonuc.append(mevcut)
                mevcut = []
                uzunluk = 0
            }
            mevcut.append(oge)
            uzunluk += ek
        }
        if !mevcut.isEmpty { sonuc.append(mevcut) }
        return sonuc
    }
}
