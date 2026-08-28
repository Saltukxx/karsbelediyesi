import SwiftUI

struct FuelView: View {
    @StateObject private var store = KBListStore(pageSize: 200) { limit in
        try await APIClient.shared.fetchFuelRecords(limit: limit)
    }
    @State private var arama = ""
    @State private var showCreate = false

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Yakıt Takip",
            description: "Araç bazlı yakıt alımları ve tutarlar.",
            action: KBHeaderAction(title: "Yeni Alım") { showCreate = true },
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Yakıt kaydı yok" : "Aramaya uyan kayıt yok",
                systemImage: "fuelpump.fill",
                message: store.isEmpty
                    ? "Yakıt alımları girildiğinde burada listelenir."
                    : "Farklı bir plaka veya istasyon araması deneyin.",
                actionTitle: store.isEmpty ? "Yeni Alım" : nil,
                action: store.isEmpty ? { showCreate = true } : nil
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                ozet
            }
            KBSearchField(text: $arama, placeholder: "Plaka veya istasyon ara...")

            ForEach(liste) { kayit in
                KBRecordCard(
                    title: kayit.plaka ?? "Plakasız araç",
                    badges: [KBBadge(text: KBFormat.litre(kayit.litre) ?? "—", tone: .info)],
                    subtitle: kayit.istasyon,
                    meta: meta(kayit),
                    accent: KBTheme.info
                )
            }

            KBLoadMoreRow(store: store, birim: "kayıt")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .sheet(isPresented: $showCreate) {
            FuelCreateSheet(store: store) { showCreate = false }
        }
    }

    private var ozet: some View {
        KBStatGrid {
            KBStatCard(
                value: KBFormat.litre(toplamLitre) ?? "0 L",
                label: "Toplam yakıt",
                icon: "fuelpump.fill",
                tone: KBTheme.info
            )
            KBStatCard(
                value: KBFormat.para(toplamTutar) ?? "0 ₺",
                label: "Toplam tutar",
                icon: "turkishlirasign.circle.fill",
                tone: KBTheme.accent
            )
        }
    }

    private var toplamLitre: Double { store.items.reduce(0) { $0 + ($1.litre ?? 0) } }
    private var toplamTutar: Double { store.items.reduce(0) { $0 + ($1.tutar ?? 0) } }

    private var gorunen: [FuelRecordDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return store.items }
        return store.items.filter { kayit in
            [kayit.plaka, kayit.istasyon].contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func meta(_ kayit: FuelRecordDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let tarih = KBFormat.tarih(kayit.tarih) {
            chips.append(KBMetaChip(icon: "calendar", text: tarih))
        }
        if let tutar = KBFormat.para(kayit.tutar) {
            chips.append(KBMetaChip(icon: "turkishlirasign.circle", text: tutar))
        }
        return chips
    }
}

private struct FuelCreateSheet: View {
    @ObservedObject var store: KBListStore<FuelRecordDTO>
    let onClose: () -> Void

    @State private var vehicles: [VehicleDTO] = []
    @State private var secenekHatasi: String?
    @State private var vehicleId = ""
    @State private var litre = "50"
    @State private var birimFiyat = ""

    var body: some View {
        KBFormSheet(
            title: "Yakıt Alımı",
            subtitle: "Litre zorunlu; birim fiyat girilirse tutar hesaplanır.",
            submitTitle: "Alımı Kaydet",
            canSubmit: !vehicleId.isEmpty && litreDegeri > 0,
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
                title: "Litre",
                required: true,
                placeholder: "50",
                text: $litre,
                keyboard: .decimalPad
            )
            KBFormTextField(
                title: "Birim fiyat (₺)",
                placeholder: "0,00",
                text: $birimFiyat,
                keyboard: .decimalPad
            )
        }
        .task {
            let sonuc = await KBOptionLoad.araclar()
            vehicles = sonuc.liste
            secenekHatasi = sonuc.hata
            if vehicleId.isEmpty { vehicleId = vehicles.first?.id ?? "" }
        }
    }

    private var litreDegeri: Double { Self.ondalik(litre) }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "Yakıt kaydı eklendi") {
                try await APIClient.shared.createFuel(
                    vehicleId: vehicleId,
                    litre: litreDegeri,
                    birimFiyat: Self.ondalik(birimFiyat)
                )
            }
            if ok { onClose() }
        }
    }

    private static func ondalik(_ text: String) -> Double {
        Double(text.replacingOccurrences(of: ",", with: ".")) ?? 0
    }
}
