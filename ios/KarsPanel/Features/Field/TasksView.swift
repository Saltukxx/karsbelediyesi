import SwiftUI

struct TasksView: View {
    @StateObject private var store = KBListStore(pageSize: 200) { limit in
        try await APIClient.shared.fetchTasks(limit: limit)
    }
    @State private var arama = ""
    @State private var durumFiltre = GorevDurumFiltre.tumu
    @State private var showCreate = false
    @State private var rotaIcin: VehicleTaskDTO?
    @State private var confirm: KBConfirmRequest?

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Görevlendirme",
            description: "Araç görevleri, başlatma ve kapatma işlemleri.",
            action: KBHeaderAction(title: "Yeni Görev") { showCreate = true },
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Görev yok" : "Filtreye uyan görev yok",
                systemImage: "list.clipboard.fill",
                message: store.isEmpty
                    ? "Araçlara görev atandığında burada listelenir."
                    : "Arama veya durum filtresini değiştirin.",
                actionTitle: store.isEmpty ? "Yeni Görev" : nil,
                action: store.isEmpty ? { showCreate = true } : nil
            ),
            refresh: { await store.load() }
        ) {
            KBSearchField(text: $arama, placeholder: "Görev no, plaka veya açıklama ara...")
            KBChipRow(selection: $durumFiltre, items: cipler)

            ForEach(liste) { gorev in
                KBRecordCard(
                    title: gorev.gorevNo ?? gorev.id,
                    badges: [KBStatus.gorev(gorev.durum)].compactMap { $0 },
                    subtitle: gorev.aciklama,
                    meta: meta(gorev),
                    actions: aksiyonlar(gorev),
                    accent: vurgu(gorev)
                )
            }

            KBLoadMoreRow(store: store, birim: "görev")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .kbConfirm($confirm)
        .sheet(isPresented: $showCreate) {
            TaskCreateSheet(store: store) { showCreate = false }
        }
        .sheet(item: $rotaIcin) { gorev in
            TaskRouteMapView(task: gorev)
        }
    }

    private var cipler: [KBChipItem<GorevDurumFiltre>] {
        GorevDurumFiltre.allCases.map { filtre in
            KBChipItem(
                value: filtre,
                label: filtre.label,
                count: store.items.filter { filtre.matches($0) }.count
            )
        }
    }

    private var gorunen: [VehicleTaskDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        return store.items.filter { gorev in
            guard durumFiltre.matches(gorev) else { return false }
            guard !sorgu.isEmpty else { return true }
            return [gorev.gorevNo, gorev.aciklama, gorev.vehicle?.plaka]
                .contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func meta(_ gorev: VehicleTaskDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let plaka = gorev.vehicle?.plaka {
            chips.append(KBMetaChip(icon: "car", text: plaka))
        }
        if let tarih = KBFormat.tarih(gorev.baslangicTarihi ?? gorev.talepTarihi) {
            chips.append(KBMetaChip(icon: "calendar", text: tarih))
        }
        if let mesafe = KBFormat.sayi(gorev.rota?.mesafeKm, birim: "km") {
            chips.append(KBMetaChip(icon: "point.topleft.down.curvedto.point.bottomright.up", text: mesafe))
        }
        return chips
    }

    private func aksiyonlar(_ gorev: VehicleTaskDTO) -> [KBRecordAction] {
        var actions: [KBRecordAction] = []
        if gorev.rota != nil {
            actions.append(
                KBRecordAction(id: "\(gorev.id)-rota", title: "Rota", icon: "map") { rotaIcin = gorev }
            )
        }
        let durum = gorev.durum?.uppercased()
        if durum == "PLANLANDI" {
            actions.append(
                KBRecordAction(id: "\(gorev.id)-baslat", title: "Başlat", icon: "play.fill", kind: .primary) {
                    Task {
                        await store.mutate(success: "Görev başlatıldı") {
                            _ = try await APIClient.shared.updateTaskKm(id: gorev.id, action: "start", km: nil)
                        }
                    }
                }
            )
        }
        if durum == "PLANLANDI" || durum == "DEVAM_EDIYOR" {
            actions.append(
                KBRecordAction(id: "\(gorev.id)-kapat", title: "Kapat", icon: "checkmark", kind: .destructive) {
                    confirm = KBConfirmRequest(
                        title: "Görev kapatılsın mı?",
                        message: "\(gorev.gorevNo ?? "Görev") tamamlandı olarak işaretlenecek.",
                        confirmTitle: "Kapat"
                    ) {
                        Task {
                            await store.mutate(success: "Görev kapatıldı") {
                                _ = try await APIClient.shared.updateTaskKm(id: gorev.id, action: "close", km: nil)
                            }
                        }
                    }
                }
            )
        }
        return actions
    }

    private func vurgu(_ gorev: VehicleTaskDTO) -> Color {
        switch gorev.durum?.uppercased() {
        case "DEVAM_EDIYOR": return KBTheme.warning
        case "TAMAMLANDI": return KBTheme.success
        case "IPTAL_EDILDI": return KBTheme.muted
        default: return KBTheme.info
        }
    }
}

enum GorevDurumFiltre: String, CaseIterable, Hashable {
    case tumu, planlandi, devam, tamamlandi

    var label: String {
        switch self {
        case .tumu: return "Tümü"
        case .planlandi: return "Planlandı"
        case .devam: return "Devam"
        case .tamamlandi: return "Tamamlandı"
        }
    }

    func matches(_ gorev: VehicleTaskDTO) -> Bool {
        let durum = gorev.durum?.uppercased()
        switch self {
        case .tumu: return true
        case .planlandi: return durum == "PLANLANDI"
        case .devam: return durum == "DEVAM_EDIYOR"
        case .tamamlandi: return durum == "TAMAMLANDI"
        }
    }
}

private struct TaskCreateSheet: View {
    @ObservedObject var store: KBListStore<VehicleTaskDTO>
    let onClose: () -> Void

    @State private var vehicles: [VehicleDTO] = []
    @State private var secenekHatasi: String?
    @State private var vehicleId = ""
    @State private var aciklama = ""

    var body: some View {
        KBFormSheet(
            title: "Yeni Görev",
            subtitle: "Görev planlandı durumunda oluşturulur.",
            submitTitle: "Görevi Oluştur",
            canSubmit: !vehicleId.isEmpty && !aciklama.trimmingCharacters(in: .whitespaces).isEmpty,
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
                title: "Görev tanımı",
                required: true,
                placeholder: "Kar küreme, çöp toplama...",
                text: $aciklama,
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
            let ok = await store.mutate(success: "Görev oluşturuldu") {
                _ = try await APIClient.shared.createTask(vehicleId: vehicleId, aciklama: aciklama)
            }
            if ok { onClose() }
        }
    }
}
