import SwiftUI

struct ComplaintCreateView: View {
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = ComplaintsViewModel()

    @State private var arayanKisi = ""
    @State private var telefon = ""
    @State private var acikAdres = ""
    @State private var aciklama = ""
    @State private var oncelik: ComplaintPriority = .NORMAL
    @State private var neighborhoodId = ""
    @State private var complaintTypeId = ""
    @State private var departmentId = ""
    @State private var lookups: LookupsDTO?
    @State private var secenekHatasi: String?

    var body: some View {
        KBFormSheet(
            title: "Yeni Şikayet",
            subtitle: "Çağrı merkezi kaydı olarak açılır.",
            submitTitle: "Şikayeti Kaydet",
            canSubmit: canSave,
            isSubmitting: viewModel.isSaving,
            errorMessage: secenekHatasi ?? viewModel.errorMessage,
            onSubmit: { Task { await save() } },
            onCancel: { dismiss() }
        ) {
            KBSectionHeader(title: "Vatandaş")
            KBFormTextField(title: "Ad soyad", required: true, placeholder: "Ayşe Demir", text: $arayanKisi)
            KBFormTextField(title: "Telefon", placeholder: "05xxxxxxxxx", text: $telefon, keyboard: .phonePad)
            KBFormTextField(
                title: "Açık adres",
                placeholder: "Sokak, no, tarif...",
                text: $acikAdres,
                multiline: true
            )

            KBSectionHeader(title: "Yönlendirme")
            KBFormPicker(
                title: "Mahalle",
                selection: $neighborhoodId,
                options: secenekler(lookups?.mahalleler)
            )
            KBFormPicker(
                title: "Şikayet türü",
                selection: $complaintTypeId,
                options: secenekler(lookups?.sikayetTurleri)
            )
            KBFormPicker(
                title: "Müdürlük",
                selection: $departmentId,
                options: secenekler(lookups?.mudurlukler)
            )
            KBFormPicker(
                title: "Öncelik",
                selection: $oncelik,
                options: ComplaintPriority.allCases.map { KBPickerOption(value: $0, label: $0.label) }
            )

            KBSectionHeader(title: "Detay")
            KBFormTextField(
                title: "Açıklama",
                placeholder: "Şikayetin içeriği...",
                text: $aciklama,
                multiline: true
            )
        }
        .task {
            do {
                lookups = try await KBReferenceCache.shared.lookups()
            } catch is CancellationError {
            } catch {
                secenekHatasi = "Mahalle ve tür listeleri yüklenemedi: \(KBErrorText.of(error))"
            }
        }
        .interactiveDismissDisabled(viewModel.isSaving)
    }

    private func secenekler(_ items: [NamedRefDTO]?) -> [KBPickerOption<String>] {
        (items ?? []).map { KBPickerOption(value: $0.id, label: $0.name ?? $0.id) }
    }

    private var canSave: Bool {
        !arayanKisi.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        let ok = await viewModel.create(
            CreateComplaintRequestDTO(
                arayanKisi: arayanKisi.trimmingCharacters(in: .whitespacesAndNewlines),
                telefon: telefon.isEmpty ? nil : telefon,
                neighborhoodId: neighborhoodId.isEmpty ? nil : neighborhoodId,
                acikAdres: acikAdres.isEmpty ? nil : acikAdres,
                complaintTypeId: complaintTypeId.isEmpty ? nil : complaintTypeId,
                departmentId: departmentId.isEmpty ? nil : departmentId,
                aciklama: aciklama.isEmpty ? nil : aciklama,
                oncelik: oncelik,
                kanal: "TELEFON"
            )
        )
        if ok {
            onCreated()
            dismiss()
        }
    }
}
