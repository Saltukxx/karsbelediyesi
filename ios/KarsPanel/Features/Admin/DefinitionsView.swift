import SwiftUI

struct DefinitionsView: View {
    @StateObject private var store = KBListStore { [try await APIClient.shared.fetchDefinitions()] }
    @State private var sekme = TanimTuru.mahalle
    @State private var arama = ""
    @State private var showCreate = false

    private var tanimlar: DefinitionsDTO? { store.items.first }

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Tanımlar",
            description: "Mahalle, müdürlük, şikayet türü ve araç cinsi listeleri.",
            action: sekme.olusturulabilir
                ? KBHeaderAction(title: "Yeni Kayıt") { showCreate = true }
                : nil,
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: "\(sekme.label) tanımı yok",
                systemImage: sekme.icon,
                message: sekme.olusturulabilir
                    ? "Sağ üstten yeni kayıt ekleyebilirsiniz."
                    : "Bu liste web panelinden yönetilir.",
                actionTitle: sekme.olusturulabilir ? "Yeni Kayıt" : nil,
                action: sekme.olusturulabilir ? { showCreate = true } : nil
            ),
            refresh: { await store.load() }
        ) {
            KBSegmentedTabs(selection: $sekme, items: sekmeler)
            KBSearchField(text: $arama, placeholder: "\(sekme.label) ara...")
            Text("\(liste.count) kayıt")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)

            ForEach(liste) { kayit in
                // Tür bilgisini sekme zaten veriyor; satıra rozet basmak gürültü.
                KBRecordCard(title: kayit.name ?? kayit.id, accent: sekme.renk)
            }
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .sheet(isPresented: $showCreate) {
            DefinitionCreateSheet(store: store, tur: sekme) { showCreate = false }
        }
    }

    private var sekmeler: [KBTabItem<TanimTuru>] {
        TanimTuru.allCases.map { KBTabItem(value: $0, label: $0.label) }
    }

    private var gorunen: [NamedRefDTO] {
        let liste = sekme.items(from: tanimlar)
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return liste }
        return liste.filter { KBSearch.eslesir($0.name, sorgu) }
    }
}

enum TanimTuru: String, CaseIterable, Hashable {
    case mahalle, mudurluk, sikayetTuru, aracCinsi

    var label: String {
        switch self {
        case .mahalle: return "Mahalle"
        case .mudurluk: return "Müdürlük"
        case .sikayetTuru: return "Şikayet Türü"
        case .aracCinsi: return "Araç Cinsi"
        }
    }

    var icon: String {
        switch self {
        case .mahalle: return "map.fill"
        case .mudurluk: return "building.2.fill"
        case .sikayetTuru: return "tag.fill"
        case .aracCinsi: return "car.fill"
        }
    }

    var renk: Color {
        switch self {
        case .mahalle: return KBTheme.info
        case .mudurluk: return KBTheme.navy
        case .sikayetTuru: return KBTheme.accent
        case .aracCinsi: return KBTheme.success
        }
    }

    /// Araç cinsleri şema tarafında sabit olduğu için mobilden eklenmez.
    var olusturulabilir: Bool {
        switch self {
        case .mahalle, .mudurluk, .sikayetTuru: return true
        case .aracCinsi: return false
        }
    }

    /// API'nin POST gövdesinde beklediği tür anahtarı.
    var apiKind: String {
        switch self {
        case .mahalle: return "neighborhood"
        case .mudurluk: return "department"
        case .sikayetTuru: return "complaintType"
        case .aracCinsi: return "vehicleType"
        }
    }

    func items(from tanimlar: DefinitionsDTO?) -> [NamedRefDTO] {
        switch self {
        case .mahalle: return tanimlar?.neighborhoods ?? []
        case .mudurluk: return tanimlar?.departments ?? []
        case .sikayetTuru: return tanimlar?.complaintTypes ?? []
        case .aracCinsi: return tanimlar?.vehicleTypes ?? []
        }
    }
}

private struct DefinitionCreateSheet: View {
    @ObservedObject var store: KBListStore<DefinitionsDTO>
    let tur: TanimTuru
    let onClose: () -> Void

    @State private var ad = ""

    var body: some View {
        KBFormSheet(
            title: "Yeni \(tur.label)",
            submitTitle: "Kaydet",
            canSubmit: !ad.trimmingCharacters(in: .whitespaces).isEmpty,
            isSubmitting: store.isSubmitting,
            errorMessage: store.errorMessage,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            KBFormTextField(title: "\(tur.label) adı", required: true, text: $ad)
        }
    }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "\(tur.label) eklendi") {
                try await APIClient.shared.createDefinition(
                    kind: tur.apiKind,
                    name: ad.trimmingCharacters(in: .whitespaces)
                )
            }
            if ok { onClose() }
        }
    }
}
