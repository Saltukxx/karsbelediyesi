import SwiftUI

struct ChecklistsView: View {
    @StateObject private var store = KBListStore(pageSize: 100) { limit in
        try await APIClient.shared.fetchChecklists(limit: limit)
    }
    @State private var arama = ""
    @State private var showCreate = false

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Kontrol Listeleri",
            description: "Araç kontrol formları ve onay durumları.",
            action: KBHeaderAction(title: "Yeni Form") { showCreate = true },
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Kontrol formu yok" : "Aramaya uyan form yok",
                systemImage: "checklist",
                message: store.isEmpty
                    ? "Şablon ve araç seçerek ilk kontrol formunu başlatabilirsiniz."
                    : "Farklı bir şablon veya operatör araması deneyin.",
                actionTitle: store.isEmpty ? "Yeni Form" : nil,
                action: store.isEmpty ? { showCreate = true } : nil
            ),
            refresh: { await store.load() }
        ) {
            KBSearchField(text: $arama, placeholder: "Şablon veya operatör ara...")

            ForEach(liste) { form in
                NavigationLink {
                    ChecklistDetailView(id: form.id, baslik: form.sablonAdi)
                } label: {
                    KBRecordCard(
                        title: form.sablonAdi ?? form.id,
                        badges: [KBStatus.kontrolFormu(form.durum)].compactMap { $0 },
                        subtitle: form.operatorAdi.map { "Operatör: \($0)" },
                        meta: KBFormat.tarih(form.createdAt).map { [KBMetaChip(icon: "calendar", text: $0)] } ?? [],
                        accent: vurgu(form),
                        showsChevron: true
                    )
                }
                .buttonStyle(.plain)
            }

            KBLoadMoreRow(store: store, birim: "form")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .sheet(isPresented: $showCreate) {
            ChecklistCreateSheet(store: store) { showCreate = false }
        }
    }

    private var gorunen: [ChecklistSubmissionDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return store.items }
        return store.items.filter { form in
            [form.sablonAdi, form.operatorAdi].contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func vurgu(_ form: ChecklistSubmissionDTO) -> Color {
        switch form.durum?.uppercased() {
        case "ONAYLANDI": return KBTheme.success
        case "ONAY_BEKLIYOR": return KBTheme.warning
        case "REDDEDILDI": return KBTheme.danger
        default: return KBTheme.navy
        }
    }
}

private struct ChecklistCreateSheet: View {
    @ObservedObject var store: KBListStore<ChecklistSubmissionDTO>
    let onClose: () -> Void

    @State private var templates: [NamedItemDTO] = []
    @State private var vehicles: [VehicleDTO] = []
    @State private var templateId = ""
    @State private var vehicleId = ""
    @State private var yuklemeHatasi: String?

    var body: some View {
        KBFormSheet(
            title: "Yeni Kontrol Formu",
            subtitle: "Şablon ve araç seçilerek taslak form açılır.",
            submitTitle: "Formu Başlat",
            canSubmit: !templateId.isEmpty && !vehicleId.isEmpty,
            isSubmitting: store.isSubmitting,
            errorMessage: store.errorMessage ?? yuklemeHatasi,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            KBFormPicker(
                title: "Şablon",
                required: true,
                selection: $templateId,
                options: templates.map { KBPickerOption(value: $0.id, label: $0.name ?? $0.id) }
            )
            KBFormPicker(
                title: "Araç",
                required: true,
                selection: $vehicleId,
                options: vehicles.map { KBPickerOption(value: $0.id, label: $0.plaka ?? $0.id) }
            )
        }
        .task { await secenekleriYukle() }
    }

    private func secenekleriYukle() async {
        do {
            templates = try await APIClient.shared.fetchChecklistTemplates()
            vehicles = try await KBReferenceCache.shared.vehicles()
            yuklemeHatasi = templates.isEmpty ? "Tanımlı kontrol şablonu bulunamadı." : nil
        } catch {
            yuklemeHatasi = KBErrorText.of(error)
        }
        if templateId.isEmpty { templateId = templates.first?.id ?? "" }
        if vehicleId.isEmpty { vehicleId = vehicles.first?.id ?? "" }
    }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "Kontrol formu oluşturuldu") {
                try await APIClient.shared.createChecklist(templateId: templateId, vehicleId: vehicleId)
            }
            if ok { onClose() }
        }
    }
}
