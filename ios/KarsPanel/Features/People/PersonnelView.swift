import SwiftUI

struct PersonnelView: View {
    @StateObject private var store = KBListStore(pageSize: 200) { limit in
        try await APIClient.shared.fetchPersonnel(limit: limit)
    }
    @State private var arama = ""
    @State private var durumFiltre = PersonelDurumFiltre.tumu
    @State private var showCreate = false
    @State private var confirm: KBConfirmRequest?

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Personel",
            description: "Kadro listesi, unvan ve çalışma durumu.",
            action: KBHeaderAction(title: "Yeni Personel") { showCreate = true },
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Personel kaydı yok" : "Filtreye uyan personel yok",
                systemImage: "person.2.fill",
                message: store.isEmpty
                    ? "Kadroya personel eklendiğinde burada listelenir."
                    : "Arama veya durum filtresini değiştirin.",
                actionTitle: store.isEmpty ? "Yeni Personel" : nil,
                action: store.isEmpty ? { showCreate = true } : nil
            ),
            refresh: { await store.load() }
        ) {
            KBSearchField(text: $arama, placeholder: "Ad soyad, unvan veya müdürlük ara...")
            KBChipRow(selection: $durumFiltre, items: cipler)

            ForEach(liste) { personel in
                KBRecordCard(
                    title: personel.adSoyad ?? personel.id,
                    badges: [KBStatus.personel(personel.durum)].compactMap { $0 },
                    subtitle: personel.unvan,
                    meta: personel.mudurluk.map { [KBMetaChip(icon: "building.2", text: $0)] } ?? [],
                    actions: aksiyonlar(personel),
                    accent: vurgu(personel)
                )
            }

            KBLoadMoreRow(store: store, birim: "personel")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .kbConfirm($confirm)
        .sheet(isPresented: $showCreate) {
            PersonnelCreateSheet(store: store) { showCreate = false }
        }
    }

    private var cipler: [KBChipItem<PersonelDurumFiltre>] {
        PersonelDurumFiltre.allCases.map { filtre in
            KBChipItem(
                value: filtre,
                label: filtre.label,
                count: store.items.filter { filtre.matches($0) }.count
            )
        }
    }

    private var gorunen: [PersonnelDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        return store.items.filter { personel in
            guard durumFiltre.matches(personel) else { return false }
            guard !sorgu.isEmpty else { return true }
            return [personel.adSoyad, personel.unvan, personel.mudurluk]
                .contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func aksiyonlar(_ personel: PersonnelDTO) -> [KBRecordAction] {
        guard personel.durum?.uppercased() != "AYRILDI" else { return [] }
        return [
            KBRecordAction(
                id: "\(personel.id)-pasif",
                title: "Pasife Al",
                icon: "person.slash",
                kind: .destructive
            ) {
                confirm = KBConfirmRequest(
                    title: "Pasife alınsın mı?",
                    message: "\(personel.adSoyad ?? "Personel") aktif kadrodan çıkarılacak.",
                    confirmTitle: "Pasife Al"
                ) {
                    Task {
                        await store.mutate(success: "Personel pasife alındı") {
                            try await APIClient.shared.deactivatePersonnel(id: personel.id)
                        }
                    }
                }
            },
        ]
    }

    private func vurgu(_ personel: PersonnelDTO) -> Color {
        switch personel.durum?.uppercased() {
        case "IZINLI": return KBTheme.info
        case "RAPORLU": return KBTheme.warning
        case "AYRILDI": return KBTheme.muted
        default: return KBTheme.success
        }
    }
}

enum PersonelDurumFiltre: String, CaseIterable, Hashable {
    case tumu, aktif, izinli, raporlu, ayrildi

    var label: String {
        switch self {
        case .tumu: return "Tümü"
        case .aktif: return "Aktif"
        case .izinli: return "İzinli"
        case .raporlu: return "Raporlu"
        case .ayrildi: return "Ayrıldı"
        }
    }

    func matches(_ personel: PersonnelDTO) -> Bool {
        let durum = personel.durum?.uppercased()
        switch self {
        case .tumu: return true
        case .aktif: return durum == "AKTIF"
        case .izinli: return durum == "IZINLI"
        case .raporlu: return durum == "RAPORLU"
        case .ayrildi: return durum == "AYRILDI"
        }
    }
}

private struct PersonnelCreateSheet: View {
    @ObservedObject var store: KBListStore<PersonnelDTO>
    let onClose: () -> Void

    @State private var adSoyad = ""
    @State private var unvan = ""

    var body: some View {
        KBFormSheet(
            title: "Yeni Personel",
            subtitle: "Kadroya aktif durumda eklenir.",
            submitTitle: "Personeli Ekle",
            canSubmit: !adSoyad.trimmingCharacters(in: .whitespaces).isEmpty,
            isSubmitting: store.isSubmitting,
            errorMessage: store.errorMessage,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            KBFormTextField(title: "Ad soyad", required: true, placeholder: "Ahmet Yılmaz", text: $adSoyad)
            KBFormTextField(title: "Unvan", placeholder: "Operatör, Şoför...", text: $unvan)
        }
    }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "Personel eklendi") {
                try await APIClient.shared.createPersonnel(
                    adSoyad: adSoyad.trimmingCharacters(in: .whitespaces),
                    unvan: unvan.isEmpty ? nil : unvan
                )
            }
            if ok { onClose() }
        }
    }
}
