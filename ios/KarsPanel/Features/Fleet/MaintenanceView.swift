import SwiftUI

struct MaintenanceView: View {
    @StateObject private var store = KBListStore(pageSize: 200) { limit in
        try await APIClient.shared.fetchMaintenance(limit: limit)
    }
    @State private var arama = ""
    @State private var showCreate = false

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Bakım Takip",
            description: "Araç bakım, onarım ve maliyet kayıtları.",
            action: KBHeaderAction(title: "Yeni Kayıt") { showCreate = true },
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Bakım kaydı yok" : "Aramaya uyan kayıt yok",
                systemImage: "wrench.and.screwdriver.fill",
                message: store.isEmpty
                    ? "Araçlara ait bakım kaydı girildiğinde burada listelenir."
                    : "Farklı bir plaka veya işlem araması deneyin.",
                actionTitle: store.isEmpty ? "Yeni Kayıt" : nil,
                action: store.isEmpty ? { showCreate = true } : nil
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                ozet
            }
            KBSearchField(text: $arama, placeholder: "Plaka veya işlem ara...")

            ForEach(liste) { kayit in
                KBRecordCard(
                    title: kayit.plaka ?? "Plakasız araç",
                    badges: [KBBadge(text: KBStatus.bakimTuru(kayit.bakimTipi) ?? "Bakım", tone: .accent)],
                    subtitle: kayit.aciklama,
                    meta: meta(kayit),
                    accent: KBTheme.accent
                )
            }

            KBLoadMoreRow(store: store, birim: "kayıt")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .sheet(isPresented: $showCreate) {
            MaintenanceCreateSheet(store: store) { showCreate = false }
        }
    }

    private var ozet: some View {
        KBStatGrid {
            KBStatCard(
                value: "\(store.items.count)",
                label: "Bakım kaydı",
                icon: "wrench.and.screwdriver.fill"
            )
            KBStatCard(
                value: KBFormat.para(toplamMaliyet) ?? "0 ₺",
                label: "Toplam maliyet",
                icon: "turkishlirasign.circle.fill",
                tone: KBTheme.accent
            )
        }
    }

    private var toplamMaliyet: Double {
        store.items.reduce(0) { $0 + ($1.maliyet ?? 0) }
    }

    private var gorunen: [MaintenanceRecordDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return store.items }
        return store.items.filter { kayit in
            [kayit.plaka, kayit.bakimTipi, kayit.aciklama]
                .contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func meta(_ kayit: MaintenanceRecordDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let tarih = KBFormat.tarih(kayit.tarih) {
            chips.append(KBMetaChip(icon: "calendar", text: tarih))
        }
        if let maliyet = KBFormat.para(kayit.maliyet) {
            chips.append(KBMetaChip(icon: "turkishlirasign.circle", text: maliyet))
        }
        return chips
    }
}

private struct MaintenanceCreateSheet: View {
    @ObservedObject var store: KBListStore<MaintenanceRecordDTO>
    let onClose: () -> Void

    @State private var vehicles: [VehicleDTO] = []
    @State private var secenekHatasi: String?
    @State private var vehicleId = ""
    @State private var islem = ""

    var body: some View {
        KBFormSheet(
            title: "Bakım Kaydı",
            subtitle: "Araç ve yapılan işlem bilgisi girilir.",
            submitTitle: "Kaydı Ekle",
            canSubmit: !vehicleId.isEmpty && !islem.trimmingCharacters(in: .whitespaces).isEmpty,
            isSubmitting: store.isSubmitting,
            errorMessage: secenekHatasi ?? store.errorMessage,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            KBFormPicker(
                title: "Araç",
                required: true,
                selection: $vehicleId,
                options: vehicles.map { KBPickerOption(value: $0.id, label: $0.plaka ?? $0.id) }
            )
            KBFormTextField(
                title: "Yapılan işlem",
                required: true,
                placeholder: "Yağ değişimi, fren balata...",
                text: $islem,
                multiline: true
            )
        }
        .task {
            let sonuc = await KBOptionLoad.araclar()
            vehicles = sonuc.liste
            secenekHatasi = sonuc.hata
            if vehicleId.isEmpty { vehicleId = vehicles.first?.id ?? "" }
        }
    }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "Bakım kaydı eklendi") {
                try await APIClient.shared.createMaintenance(vehicleId: vehicleId, notes: islem)
            }
            if ok { onClose() }
        }
    }
}
