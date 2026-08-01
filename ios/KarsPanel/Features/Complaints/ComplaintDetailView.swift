import SwiftUI

/// `/sikayetler/[id]` — şikayet kartı, atama akışları, durum güncelleme,
/// işlem geçmişi ve iş emri raporu (native PDF).
struct ComplaintDetailView: View {
    let complaintId: String

    @EnvironmentObject private var session: AppSession
    @StateObject private var viewModel: ComplaintDetailViewModel
    @ObservedObject private var lookups = LookupStore.shared
    @State private var raporGosteriliyor = false

    init(complaintId: String, api: APIClient = .shared) {
        self.complaintId = complaintId
        _viewModel = StateObject(
            wrappedValue: ComplaintDetailViewModel(complaintId: complaintId, api: api)
        )
    }

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if let sikayet = viewModel.sikayet {
                Section {
                    HStack(spacing: 8) {
                        if let durum = sikayet.durum {
                            StatusBadge(text: durum.label, tone: durum.badgeTone)
                        }
                        if let oncelik = sikayet.oncelik {
                            StatusBadge(text: oncelik.label, tone: oncelik.badgeTone)
                        }
                        Spacer(minLength: 0)
                    }
                }

                bilgiSection(sikayet)

                if let aciklama = sikayet.aciklama, !aciklama.isEmpty {
                    Section("Şikayet Metni") {
                        Text(aciklama).font(.subheadline).foregroundStyle(KBTheme.navy)
                    }
                }

                if !sikayet.fotograflar.isEmpty {
                    Section("Fotoğraflar (\(sikayet.fotograflar.count))") {
                        ComplaintPhotoStrip(photos: sikayet.fotograflar)
                            .listRowInsets(
                                EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
                            )
                    }
                }

                gorevlendirmeSection(sikayet)

                if sikayet.acikMi, session.canRouteComplaintToDepartment {
                    mudurlukSection(sikayet)
                }

                if sikayet.acikMi, session.canAssignComplaintPersonnel {
                    personelSection(sikayet)
                }

                if sikayet.acikMi {
                    atamaSection(sikayet)
                    durumSection(sikayet)
                }

                gecmisSection(sikayet)
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(viewModel.sikayet?.sikayetNo ?? "Şikayet")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if viewModel.sikayet != nil {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        raporGosteriliyor = true
                    } label: {
                        Label("İş Emri Raporu", systemImage: "doc.text")
                    }
                    .accessibilityLabel("İş emri raporu")
                }
            }
        }
        .refreshable { await viewModel.load() }
        .task {
            await viewModel.load()
            await lookups.loadIfNeeded()
            viewModel.formuHazirla()
        }
        .sheet(isPresented: $raporGosteriliyor) {
            if let sikayet = viewModel.sikayet {
                PDFPreviewSheet(
                    document: ComplaintWorkOrderPDF(complaint: sikayet),
                    fileName: "is-emri-\(sikayet.sikayetNo ?? sikayet.id).pdf"
                )
            }
        }
        .overlay {
            if viewModel.isLoading, viewModel.sikayet == nil { LoadingOverlay() }
        }
    }

    // MARK: - Bölümler

    @ViewBuilder
    private func bilgiSection(_ sikayet: ComplaintDetailDTO) -> some View {
        Section("Şikayet Bilgileri") {
            KBDetailRow(label: "Kayıt tarihi", value: sikayet.kayitTarihi.kbAn)
            KBDetailRow(label: "Kanal", value: ComplaintChannel.label(sikayet.kanal))
            KBDetailRow(label: "Arayan kişi", value: sikayet.arayanKisi)
            if let telefon = sikayet.telefon, !telefon.isEmpty {
                KBPhoneRow(telefon: telefon)
            }
            KBDetailRow(label: "Şikayet türü", value: sikayet.complaintType?.name)
            KBDetailRow(label: "Yönlendirilen müdürlük", value: sikayet.department?.name)
            KBDetailRow(label: "Mahalle", value: sikayet.neighborhood?.name)
            KBDetailRow(label: "Açık adres", value: sikayet.acikAdres)
            if sikayet.durum == .KAPATILDI {
                KBDetailRow(label: "Kapanış tarihi", value: sikayet.kapanisTarihi.kbAn)
                KBDetailRow(label: "Onaylayan", value: sikayet.onaylayanAdi)
                KBDetailRow(label: "Çözüm notu", value: sikayet.cozumNotu)
            }
        }
    }

    @ViewBuilder
    private func gorevlendirmeSection(_ sikayet: ComplaintDetailDTO) -> some View {
        Section("Görevlendirme") {
            KBDetailRow(label: "Araç plakası", value: sikayet.vehicle?.plaka)
            KBDetailRow(label: "Şoför adı", value: sikayet.soforAdi)
            if let soforTelefonu = sikayet.soforTelefonu, !soforTelefonu.isEmpty {
                KBPhoneRow(telefon: soforTelefonu)
            }
            if sikayet.personel.isEmpty {
                KBDetailRow(label: "Görevlendirilen personel", value: nil)
            } else {
                ForEach(sikayet.personel) { personel in
                    KBDetailRow(label: personel.adSoyad, value: personel.unvan)
                }
            }
        }
    }

    @ViewBuilder
    private func mudurlukSection(_ sikayet: ComplaintDetailDTO) -> some View {
        Section("Müdürlüğe Yönlendir") {
            KBPickerField(
                title: "Müdürlük",
                items: lookups.mudurlukler,
                selection: $viewModel.departmentId,
                placeholder: "— Müdürlük yok —",
                label: { $0.name ?? $0.id }
            )
            KBFormActions(
                saveTitle: "Yönlendir",
                isSaving: viewModel.kaydedilenAtama == .mudurluk,
                isEnabled: viewModel.kaydedilenAtama == nil
            ) {
                Task { await viewModel.mudurlukAta() }
            }
        }
    }

    @ViewBuilder
    private func personelSection(_ sikayet: ComplaintDetailDTO) -> some View {
        Section("Personele Ata") {
            KBMultiSelectField(
                title: "Personel",
                items: lookups.personeller,
                selection: $viewModel.personnelIds,
                label: \.etiket
            )
            KBFormActions(
                saveTitle: "Personele Ata",
                isSaving: viewModel.kaydedilenAtama == .personel,
                isEnabled: viewModel.kaydedilenAtama == nil
                    && !viewModel.personnelIds.isEmpty
            ) {
                Task { await viewModel.personelAta() }
            }
        }
    }

    @ViewBuilder
    private func atamaSection(_ sikayet: ComplaintDetailDTO) -> some View {
        Section {
            KBPickerField(
                title: "Araç (Plaka)",
                items: lookups.araclar,
                selection: $viewModel.vehicleId,
                placeholder: "— Araç yok —",
                label: \.etiket
            )
            KBMultiSelectField(
                title: "Personel",
                items: lookups.personeller,
                selection: $viewModel.atamaPersonnelIds,
                label: \.etiket
            )
            KBFormActions(
                saveTitle: "Görevlendir",
                isSaving: viewModel.kaydedilenAtama == .arac,
                isEnabled: viewModel.kaydedilenAtama == nil
            ) {
                Task { await viewModel.aracAta() }
            }
        } header: {
            Text("Araç ve Personel Görevlendir")
        } footer: {
            Text("Görevlendirme mevcut personel listesini seçtiklerinizle değiştirir.")
        }
    }

    @ViewBuilder
    private func durumSection(_ sikayet: ComplaintDetailDTO) -> some View {
        Section("Durum Güncelle / Kapat") {
            Picker("Yeni durum", selection: $viewModel.hedefDurum) {
                ForEach(ComplaintStatus.allCases, id: \.self) { durum in
                    Text(durum.label).tag(durum)
                }
            }
            .pickerStyle(.menu)

            KBTextField(
                title: "Çözüm notu",
                text: $viewModel.cozumNotu,
                placeholder: "Kapatırken doldurulması önerilir",
                multiline: true
            )

            KBFormActions(
                saveTitle: "Durumu Güncelle",
                isSaving: viewModel.isSaving,
                isEnabled: viewModel.hedefDurum != sikayet.durum
            ) {
                Task { await viewModel.durumGuncelle() }
            }
        }
    }

    @ViewBuilder
    private func gecmisSection(_ sikayet: ComplaintDetailDTO) -> some View {
        Section("İşlem Geçmişi (\(sikayet.olaylar.count))") {
            ForEach(sikayet.olaylar.reversed()) { olay in
                VStack(alignment: .leading, spacing: 3) {
                    Text(olay.label)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(KBTheme.navy)
                    Text("\(olay.kullanici ?? "Sistem") · \(olay.createdAt.kbAn)")
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                    if let degisim = olay.degisim {
                        Text(degisim)
                            .font(.caption)
                            .foregroundStyle(KBTheme.muted)
                    }
                }
                .padding(.leading, 10)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(KBTheme.info.opacity(0.35))
                        .frame(width: 2)
                }
            }
        }
    }
}

@MainActor
final class ComplaintDetailViewModel: ObservableObject {
    /// Aynı anda yalnız bir atama formu kaydeder; hangisi olduğunu gösterir.
    enum AssignmentKind { case mudurluk, personel, arac }

    @Published private(set) var sikayet: ComplaintDetailDTO?
    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published private(set) var kaydedilenAtama: AssignmentKind?
    @Published var errorMessage: String?

    @Published var departmentId: String?
    @Published var personnelIds: Set<String> = []
    @Published var vehicleId: String?
    @Published var atamaPersonnelIds: Set<String> = []
    @Published var hedefDurum: ComplaintStatus = .DEVAM_EDIYOR
    @Published var cozumNotu = ""

    private let complaintId: String
    private let api: APIClient

    init(complaintId: String, api: APIClient = .shared) {
        self.complaintId = complaintId
        self.api = api
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            sikayet = try await api.fetchComplaint(id: complaintId)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    /// Formlar mevcut değerlerle açılır (web'in `defaultValue` davranışı).
    func formuHazirla() {
        guard let sikayet else { return }
        departmentId = sikayet.departmentId
        vehicleId = sikayet.vehicleId
        atamaPersonnelIds = Set(sikayet.personel.map(\.id))
        hedefDurum = sikayet.durum ?? .DEVAM_EDIYOR
        cozumNotu = sikayet.cozumNotu ?? ""
    }

    func mudurlukAta() async {
        await atamaYap(.mudurluk, .mudurluk(departmentId: departmentId))
    }

    func personelAta() async {
        await atamaYap(.personel, .personel(personnelIds: Array(personnelIds)))
        personnelIds = []
    }

    func aracAta() async {
        await atamaYap(
            .arac,
            .arac(vehicleId: vehicleId, personnelIds: Array(atamaPersonnelIds))
        )
    }

    func durumGuncelle() async {
        isSaving = true
        errorMessage = nil
        do {
            _ = try await api.updateComplaint(
                id: complaintId,
                body: UpdateComplaintRequestDTO(
                    durum: hedefDurum,
                    cozumNotu: cozumNotu.bosDegilse,
                    lat: nil,
                    lng: nil
                )
            )
            await yenile()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isSaving = false
    }

    private func atamaYap(_ kind: AssignmentKind, _ assignment: ComplaintAssignment) async {
        kaydedilenAtama = kind
        errorMessage = nil
        do {
            try await api.assignComplaint(id: complaintId, assignment)
            await yenile()
        } catch {
            errorMessage = APIError.describe(error)
        }
        kaydedilenAtama = nil
    }

    private func yenile() async {
        await load()
        formuHazirla()
    }
}

extension AppSession {
    /// Web: müdürlüğe yönlendirme ADMIN + CALL_CENTER (`ACTION_ROLES.whatsapp`).
    var canRouteComplaintToDepartment: Bool {
        role == .ADMIN || role == .CALL_CENTER
    }

    /// Web: personel atama ADMIN veya müdürlüğü olan DEPARTMENT_MANAGER.
    var canAssignComplaintPersonnel: Bool {
        role == .ADMIN
            || (role == .DEPARTMENT_MANAGER && user?.departmentId != nil)
    }
}
