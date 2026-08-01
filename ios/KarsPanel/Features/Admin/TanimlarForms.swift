import SwiftUI

/// Tanımlar ekranının açtığı form hedefleri. `Identifiable` olmaları
/// `.sheet(item:)` ile "yeni" ve "düzenle" durumlarını ayırt etmeyi sağlar.
enum MudurlukFormHedefi: Identifiable {
    case yeni
    case duzenle(MudurlukTanimDTO)

    var id: String {
        switch self {
        case .yeni: return "yeni"
        case let .duzenle(m): return m.id
        }
    }

    var kayit: MudurlukTanimDTO? {
        switch self {
        case .yeni: return nil
        case let .duzenle(m): return m
        }
    }
}

enum SikayetTuruFormHedefi: Identifiable {
    case yeni
    case duzenle(SikayetTuruTanimDTO)

    var id: String {
        switch self {
        case .yeni: return "yeni"
        case let .duzenle(t): return t.id
        }
    }

    var kayit: SikayetTuruTanimDTO? {
        switch self {
        case .yeni: return nil
        case let .duzenle(t): return t
        }
    }
}

enum KullaniciFormHedefi: Identifiable {
    case yeni
    case duzenle(PanelKullaniciDTO)

    var id: String {
        switch self {
        case .yeni: return "yeni"
        case let .duzenle(k): return k.id
        }
    }

    var kayit: PanelKullaniciDTO? {
        switch self {
        case .yeni: return nil
        case let .duzenle(k): return k
        }
    }
}

// MARK: - Müdürlük

struct MudurlukFormView: View {
    let hedef: MudurlukFormHedefi
    @ObservedObject var viewModel: TanimlarViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var ad = ""
    @State private var kisaAd = ""
    @State private var aktif = true
    @State private var hata: String?

    var body: some View {
        Form {
            Section {
                KBTextField(title: "Ad", text: $ad, required: true)
                KBTextField(
                    title: "Kısa Ad",
                    text: $kisaAd,
                    placeholder: "Su ve Kan."
                )
                if hedef.kayit != nil {
                    Toggle("Aktif", isOn: $aktif)
                }
            } footer: {
                if hedef.kayit == nil {
                    Text("Kısa ad boş bırakılırsa adın ilk 20 karakteri kullanılır.")
                }
            }

            Section {
                KBFormActions(
                    saveTitle: "Kaydet",
                    isSaving: viewModel.islemYapiliyor,
                    isEnabled: !ad.trimmingCharacters(in: .whitespaces).isEmpty,
                    errorMessage: hata,
                    onSave: kaydet,
                    onCancel: { dismiss() }
                )
            }
        }
        .navigationTitle(hedef.kayit == nil ? "Yeni Müdürlük" : "Müdürlük")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard let m = hedef.kayit else { return }
            ad = m.name
            kisaAd = m.shortName
            aktif = m.aktif
        }
    }

    private func kaydet() {
        hata = nil
        let body = MudurlukRequestDTO(
            name: ad.trimmingCharacters(in: .whitespaces),
            shortName: kisaAd.trimmingCharacters(in: .whitespaces).isEmpty
                ? nil
                : kisaAd.trimmingCharacters(in: .whitespaces),
            // Yeni kayıt varsayılan olarak aktif açılır (sunucu varsayılanı)
            aktif: hedef.kayit == nil ? true : aktif
        )
        Task {
            if await viewModel.mudurlukKaydet(id: hedef.kayit?.id, body) {
                dismiss()
            } else {
                hata = viewModel.errorMessage
            }
        }
    }
}

// MARK: - Şikayet türü

struct SikayetTuruFormView: View {
    let hedef: SikayetTuruFormHedefi
    @ObservedObject var viewModel: TanimlarViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var ad = ""
    @State private var mudurlukId: String?
    @State private var aktif = true
    @State private var hata: String?

    var body: some View {
        Form {
            Section {
                KBTextField(title: "Tür", text: $ad, required: true)
                KBPickerField(
                    title: "Varsayılan Müdürlük",
                    items: viewModel.mudurlukler,
                    selection: $mudurlukId,
                    placeholder: "—"
                ) { $0.shortName.isEmpty ? $0.name : $0.shortName }
                if hedef.kayit != nil {
                    Toggle("Aktif", isOn: $aktif)
                }
            } footer: {
                Text("Varsayılan müdürlük seçilirse bu türdeki şikayetler doğrudan o müdürlüğe düşer.")
            }

            Section {
                KBFormActions(
                    saveTitle: "Kaydet",
                    isSaving: viewModel.islemYapiliyor,
                    isEnabled: !ad.trimmingCharacters(in: .whitespaces).isEmpty,
                    errorMessage: hata,
                    onSave: kaydet,
                    onCancel: { dismiss() }
                )
            }
        }
        .navigationTitle(hedef.kayit == nil ? "Yeni Tür" : "Şikayet Türü")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard let t = hedef.kayit else { return }
            ad = t.name
            mudurlukId = t.defaultDepartmentId
            aktif = t.aktif
        }
    }

    private func kaydet() {
        hata = nil
        let body = SikayetTuruRequestDTO(
            name: ad.trimmingCharacters(in: .whitespaces),
            defaultDepartmentId: mudurlukId,
            aktif: hedef.kayit == nil ? true : aktif
        )
        Task {
            if await viewModel.sikayetTuruKaydet(id: hedef.kayit?.id, body) {
                dismiss()
            } else {
                hata = viewModel.errorMessage
            }
        }
    }
}

// MARK: - Kullanıcı

struct KullaniciFormView: View {
    let hedef: KullaniciFormHedefi
    @ObservedObject var viewModel: TanimlarViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var ad = ""
    @State private var telefon = ""
    @State private var eposta = ""
    @State private var rol: UserRole = .CALL_CENTER
    @State private var mudurlukId: String?
    @State private var sifre = ""
    @State private var aktif = true
    @State private var hata: String?

    private var yeniKayit: Bool { hedef.kayit == nil }

    var body: some View {
        Form {
            Section {
                KBTextField(title: "Ad", text: $ad, required: true)
                KBTextField(
                    title: "Telefon",
                    text: $telefon,
                    required: true,
                    placeholder: "05xxxxxxxxx",
                    keyboard: .phonePad
                )
                KBTextField(
                    title: "E-posta",
                    text: $eposta,
                    keyboard: .emailAddress,
                    capitalization: .never
                )
            }

            Section {
                KBFieldContainer(title: "Rol", required: true) {
                    Picker("Rol", selection: $rol) {
                        ForEach(UserRole.allCases, id: \.self) { r in
                            Text(r.label).tag(r)
                        }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                KBPickerField(
                    title: "Müdürlük",
                    items: viewModel.mudurlukler,
                    selection: $mudurlukId,
                    required: rol == .DEPARTMENT_MANAGER,
                    placeholder: "—"
                ) { $0.shortName.isEmpty ? $0.name : $0.shortName }
                if !yeniKayit {
                    Toggle("Aktif", isOn: $aktif)
                }
            } footer: {
                if rol == .DEPARTMENT_MANAGER {
                    Text("Müdürlük yöneticisi için müdürlük seçimi zorunludur.")
                }
            }

            Section {
                SecureField(
                    yeniKayit ? "Şifre" : "Yeni şifre (değiştirmek için)",
                    text: $sifre
                )
                .textContentType(.newPassword)
                .frame(minHeight: KBTheme.touchMin)
            } header: {
                Text(yeniKayit ? "Şifre" : "Şifre Sıfırlama")
            } footer: {
                Text("En az 8 karakter, en az bir harf ve bir rakam.")
            }

            Section {
                KBFormActions(
                    saveTitle: "Kaydet",
                    isSaving: viewModel.islemYapiliyor,
                    errorMessage: hata,
                    onSave: kaydet,
                    onCancel: { dismiss() }
                )
            }
        }
        .navigationTitle(yeniKayit ? "Yeni Kullanıcı" : "Kullanıcı")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard let k = hedef.kayit else { return }
            ad = k.name
            telefon = k.phone
            eposta = k.email ?? ""
            rol = k.role
            mudurlukId = k.departmentId
            aktif = k.aktif
        }
    }

    private func kaydet() {
        // Sunucuya gitmeden aynı kuralları uygula; hata mesajları web ile aynı
        if let dogrulama = KullaniciFormValidation.hata(
            ad: ad,
            telefon: telefon,
            rol: rol,
            departmentId: mudurlukId,
            sifre: sifre,
            sifreZorunlu: yeniKayit
        ) {
            hata = dogrulama
            return
        }
        hata = nil

        let temizAd = ad.trimmingCharacters(in: .whitespaces)
        let temizTelefon = telefon.trimmingCharacters(in: .whitespaces)
        let temizEposta = eposta.trimmingCharacters(in: .whitespaces)

        Task {
            let basarili: Bool
            if let mevcut = hedef.kayit {
                basarili = await viewModel.kullaniciGuncelle(
                    id: mevcut.id,
                    KullaniciGuncelleRequestDTO(
                        name: temizAd,
                        phone: temizTelefon,
                        email: temizEposta,
                        role: rol.rawValue,
                        departmentId: mudurlukId,
                        aktif: aktif,
                        password: sifre.isEmpty ? nil : sifre
                    )
                )
            } else {
                basarili = await viewModel.kullaniciOlustur(
                    KullaniciOlusturRequestDTO(
                        name: temizAd,
                        phone: temizTelefon,
                        email: temizEposta.isEmpty ? nil : temizEposta,
                        password: sifre,
                        role: rol.rawValue,
                        departmentId: mudurlukId
                    )
                )
            }
            if basarili {
                dismiss()
            } else {
                hata = viewModel.errorMessage
            }
        }
    }
}
