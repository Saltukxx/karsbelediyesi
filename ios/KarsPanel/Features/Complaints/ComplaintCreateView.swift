import SwiftUI

struct ComplaintCreateView: View {
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = ComplaintsViewModel()
    @FocusState private var focused: Field?

    @State private var arayanKisi = ""
    @State private var telefon = ""
    @State private var acikAdres = ""
    @State private var aciklama = ""
    @State private var oncelik: ComplaintPriority = .NORMAL
    @State private var neighborhoodId: String?
    @State private var complaintTypeId: String?
    @State private var departmentId: String?
    @State private var lookups: LookupsDTO?

    private enum Field { case name, phone, address, note }

    var body: some View {
        Form {
            if let error = viewModel.errorMessage {
                Section { ErrorBanner(message: error) }
            }

            Section {
                TextField("Ad Soyad", text: $arayanKisi)
                    .textContentType(.name)
                    .focused($focused, equals: .name)
                TextField("Telefon", text: $telefon)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .focused($focused, equals: .phone)
                TextField("Açık Adres", text: $acikAdres, axis: .vertical)
                    .lineLimit(2...4)
                    .focused($focused, equals: .address)
            } header: {
                Text("Vatandaş")
            }

            Section {
                Picker("Mahalle", selection: $neighborhoodId) {
                    Text("Seçiniz").tag(Optional<String>.none)
                    ForEach(lookups?.mahalleler ?? [], id: \.id) { item in
                        Text(item.name ?? item.id).tag(Optional(item.id))
                    }
                }
                Picker("Şikayet Türü", selection: $complaintTypeId) {
                    Text("Seçiniz").tag(Optional<String>.none)
                    ForEach(lookups?.sikayetTurleri ?? [], id: \.id) { item in
                        Text(item.name ?? item.id).tag(Optional(item.id))
                    }
                }
                Picker("Müdürlük", selection: $departmentId) {
                    Text("Seçiniz").tag(Optional<String>.none)
                    ForEach(lookups?.mudurlukler ?? [], id: \.id) { item in
                        Text(item.name ?? item.id).tag(Optional(item.id))
                    }
                }
                Picker("Öncelik", selection: $oncelik) {
                    ForEach(ComplaintPriority.allCases, id: \.self) { p in
                        Text(p.label).tag(p)
                    }
                }
            } header: {
                Text("Yönlendirme")
            }

            Section {
                TextField("Açıklama", text: $aciklama, axis: .vertical)
                    .lineLimit(3...8)
                    .focused($focused, equals: .note)
            } header: {
                Text("Detay")
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Yeni Şikayet")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            lookups = try? await APIClient.shared.fetchLookups()
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("İptal") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Kaydet") {
                    focused = nil
                    Task { await save() }
                }
                .fontWeight(.semibold)
                .disabled(!canSave || viewModel.isSaving)
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Tamam") { focused = nil }
            }
        }
        .overlay {
            if viewModel.isSaving { LoadingOverlay() }
        }
        .interactiveDismissDisabled(viewModel.isSaving)
    }

    private var canSave: Bool {
        !arayanKisi.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        let ok = await viewModel.create(
            CreateComplaintRequestDTO(
                arayanKisi: arayanKisi.trimmingCharacters(in: .whitespacesAndNewlines),
                telefon: telefon.isEmpty ? nil : telefon,
                neighborhoodId: neighborhoodId,
                acikAdres: acikAdres.isEmpty ? nil : acikAdres,
                complaintTypeId: complaintTypeId,
                departmentId: departmentId,
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
