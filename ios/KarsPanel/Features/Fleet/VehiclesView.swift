import SwiftUI

struct VehiclesView: View {
    @StateObject private var store = KBListStore(pageSize: 200) { limit in
        try await APIClient.shared.fetchVehicles(limit: limit)
    }
    @State private var arama = ""
    @State private var durumFiltre = VehicleDurumFiltre.tumu
    @State private var showCreate = false
    @State private var confirm: KBConfirmRequest?

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Araç Envanteri",
            description: "Filo envanteri, operasyon durumu ve birim zimmetleri.",
            action: KBHeaderAction(title: "Yeni Araç") { showCreate = true },
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Araç bulunamadı" : "Filtreye uyan araç yok",
                systemImage: "car.fill",
                message: store.isEmpty
                    ? "Henüz araç kaydı yok. Sağ üstten yeni araç ekleyebilirsiniz."
                    : "Arama veya durum filtresini değiştirin.",
                actionTitle: store.isEmpty ? "Yeni Araç" : nil,
                action: store.isEmpty ? { showCreate = true } : nil
            ),
            refresh: { await store.load() }
        ) {
            filtreler(liste.count)

            ForEach(liste) { arac in
                KBRecordCard(
                    title: arac.plaka ?? "Plakasız",
                    badges: rozetler(arac),
                    subtitle: altBilgi(arac),
                    meta: meta(arac),
                    actions: aksiyonlar(arac),
                    accent: vurgu(arac)
                )
            }

            KBLoadMoreRow(store: store, birim: "araç")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .kbConfirm($confirm)
        .sheet(isPresented: $showCreate) {
            VehicleCreateSheet(store: store) { showCreate = false }
        }
    }

    @ViewBuilder
    private func filtreler(_ sayi: Int) -> some View {
        KBSearchField(text: $arama, placeholder: "Plaka, marka veya model ara...")
        KBChipRow(selection: $durumFiltre, items: cipler)
        Text("\(sayi) araç listeleniyor")
            .font(.caption)
            .foregroundStyle(KBTheme.muted)
    }

    private var cipler: [KBChipItem<VehicleDurumFiltre>] {
        VehicleDurumFiltre.allCases.map { filtre in
            KBChipItem(
                value: filtre,
                label: filtre.label,
                count: store.items.filter { filtre.matches($0) }.count
            )
        }
    }

    private var gorunen: [VehicleDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        return store.items.filter { arac in
            guard durumFiltre.matches(arac) else { return false }
            guard !sorgu.isEmpty else { return true }
            let alanlar = [arac.plaka, arac.marka, arac.model, arac.cins]
            return alanlar.contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func rozetler(_ arac: VehicleDTO) -> [KBBadge] {
        [KBStatus.envanter(arac.envanterDurumu), KBStatus.operasyon(arac.operasyonDurumu)].compactMap { $0 }
    }

    private func altBilgi(_ arac: VehicleDTO) -> String? {
        let parcalar = [arac.marka, arac.model].compactMap { $0 }.filter { !$0.isEmpty }
        return parcalar.isEmpty ? nil : parcalar.joined(separator: " ")
    }

    private func meta(_ arac: VehicleDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let cins = arac.cins, !cins.isEmpty {
            chips.append(KBMetaChip(icon: "tag", text: cins))
        }
        if let sayac = KBFormat.sayi(arac.sayacDeger, birim: "km") {
            chips.append(KBMetaChip(icon: "speedometer", text: sayac))
        }
        if arac.atananSoforId != nil {
            chips.append(KBMetaChip(icon: "person.fill", text: "Şoför atanmış"))
        }
        return chips
    }

    private func aksiyonlar(_ arac: VehicleDTO) -> [KBRecordAction] {
        guard arac.envanterDurumu?.uppercased() != "HURDAYA_AYRILDI" else { return [] }
        return [
            KBRecordAction(
                id: "\(arac.id)-hurda",
                title: "Hurdaya Ayır",
                icon: "trash",
                kind: .destructive
            ) {
                confirm = KBConfirmRequest(
                    title: "Hurdaya ayrılsın mı?",
                    message: "\(arac.plaka ?? "Araç") envanterden hurdaya alınacak.",
                    confirmTitle: "Hurdaya Ayır"
                ) {
                    Task {
                        await store.mutate(success: "Araç hurdaya ayrıldı") {
                            try await APIClient.shared.scrapVehicle(id: arac.id)
                        }
                    }
                }
            },
        ]
    }

    private func vurgu(_ arac: VehicleDTO) -> Color {
        switch arac.envanterDurumu?.uppercased() {
        case "ARIZALI": return KBTheme.danger
        case "BAKIMDA": return KBTheme.warning
        case "HURDAYA_AYRILDI": return KBTheme.muted
        default: return KBTheme.success
        }
    }
}

enum VehicleDurumFiltre: String, CaseIterable, Hashable {
    case tumu, aktif, bakimda, arizali, hurda

    var label: String {
        switch self {
        case .tumu: return "Tümü"
        case .aktif: return "Aktif"
        case .bakimda: return "Bakımda"
        case .arizali: return "Arızalı"
        case .hurda: return "Hurda"
        }
    }

    func matches(_ arac: VehicleDTO) -> Bool {
        let durum = arac.envanterDurumu?.uppercased()
        switch self {
        case .tumu: return true
        case .aktif: return durum == "AKTIF"
        case .bakimda: return durum == "BAKIMDA"
        case .arizali: return durum == "ARIZALI"
        case .hurda: return durum == "HURDAYA_AYRILDI"
        }
    }
}

private struct VehicleCreateSheet: View {
    @ObservedObject var store: KBListStore<VehicleDTO>
    let onClose: () -> Void

    @State private var plaka = ""
    @State private var marka = ""

    var body: some View {
        KBFormSheet(
            title: "Yeni Araç",
            subtitle: "Plaka zorunlu, marka bilgisi sonradan güncellenebilir.",
            submitTitle: "Aracı Ekle",
            canSubmit: !plaka.trimmingCharacters(in: .whitespaces).isEmpty,
            isSubmitting: store.isSubmitting,
            errorMessage: store.errorMessage,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            KBFormTextField(title: "Plaka", required: true, placeholder: "36 ABC 123", text: $plaka)
            KBFormTextField(title: "Marka", placeholder: "Ford, Mercedes...", text: $marka)
        }
    }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "Araç eklendi") {
                _ = try await APIClient.shared.createVehicle(
                    plaka: plaka.trimmingCharacters(in: .whitespaces),
                    marka: marka.isEmpty ? nil : marka
                )
            }
            if ok { onClose() }
        }
    }
}
