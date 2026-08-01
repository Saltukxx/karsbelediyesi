import SwiftUI

/// `/kontrol-listeleri/[id]` — kalem × periyot matrisi. Web'de tablo, mobilde
/// kalem başına açılan periyot satırları; aynı veriyi aynı kurallarla yazar.
struct ChecklistDetailView: View {
    let submissionId: String

    @EnvironmentObject private var session: AppSession
    @StateObject private var viewModel: ChecklistDetailViewModel
    @ObservedObject private var queue = ChecklistOfflineQueue.shared
    @State private var duzenlenenKalem: ChecklistItemEditTarget?
    @State private var onayaGonderGosteriliyor = false
    @State private var kararGosteriliyor = false
    @State private var raporGosteriliyor = false

    init(submissionId: String, api: APIClient = .shared) {
        self.submissionId = submissionId
        _viewModel = StateObject(
            wrappedValue: ChecklistDetailViewModel(submissionId: submissionId, api: api)
        )
    }

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if let infoMessage = viewModel.infoMessage {
                Section {
                    Label(infoMessage, systemImage: "info.circle")
                        .font(.subheadline)
                        .foregroundStyle(KBTheme.info)
                }
            }

            if !queue.pending.isEmpty {
                Section { ChecklistQueueBanner() }
            }

            if let form = viewModel.form {
                Section {
                    HStack(spacing: 8) {
                        StatusBadge(
                            text: form.durumu?.displayName ?? form.durum,
                            tone: (form.durumu?.badgeTone ?? .neutral).badge
                        )
                        if form.arizaliSayisi > 0 {
                            StatusBadge(
                                text: "\(form.arizaliSayisi) arızalı",
                                tone: .danger
                            )
                        }
                        if form.dikkatSayisi > 0 {
                            StatusBadge(
                                text: "\(form.dikkatSayisi) dikkat",
                                tone: .warning
                            )
                        }
                        Spacer(minLength: 0)
                    }
                }

                Section("Form Bilgisi") {
                    KBDetailRow(label: "Plaka", value: form.plaka)
                    KBDetailRow(label: "Araç", value: form.aracAdi)
                    KBDetailRow(label: "Dönem", value: form.donem)
                    KBDetailRow(label: "Şantiye / Lokasyon", value: form.santiyeLokasyon)
                    KBDetailRow(
                        label: "Sorumlu operatör",
                        value: form.sorumluOperatorTeknisyen ?? form.operatorAdi
                    )
                    KBDetailRow(label: "Teknisyen", value: form.teknisyenAdi)
                    KBDetailRow(label: "Şef / Amir", value: form.sefAmirAdi)
                    if form.onayTarihi != nil {
                        KBDetailRow(
                            label: "Onay",
                            value: [form.onaylayanAdi ?? form.sefAmirAdi, form.onayTarihi?.kbGun]
                                .compactMap { $0 }
                                .joined(separator: " · ")
                        )
                    }
                }

                ForEach(form.kategoriler) { kategori in
                    Section(kategori.kategori) {
                        ForEach(kategori.kalemler) { kalem in
                            ChecklistItemRow(
                                kalem: kalem,
                                periyotlar: form.periyotlar,
                                duzenlenebilir: form.duzenlenebilir
                            ) { periyot in
                                duzenlenenKalem = ChecklistItemEditTarget(
                                    kalem: kalem,
                                    periyot: periyot
                                )
                            }
                        }
                    }
                }

                if form.durumu == .TASLAK, form.duzenlenebilir {
                    Section {
                        Button("Onaya Gönder") { onayaGonderGosteriliyor = true }
                            .buttonStyle(KBPrimaryButtonStyle())
                    } footer: {
                        Text("Onaya gönderilen form onaylanana kadar düzenlenebilir.")
                    }
                }

                if form.durumu == .ONAY_BEKLIYOR, session.canDecideChecklist {
                    Section {
                        Button("Onay Kararı Ver") { kararGosteriliyor = true }
                            .buttonStyle(KBPrimaryButtonStyle())
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(viewModel.form?.sablonAdi ?? "Kontrol Formu")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if viewModel.form != nil {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        raporGosteriliyor = true
                    } label: {
                        Label("PDF / Yazdır", systemImage: "printer")
                    }
                    .accessibilityLabel("Kontrol formunu yazdır")
                }
            }
        }
        .refreshable { await viewModel.load() }
        .task {
            if await queue.flush() > 0 || viewModel.form == nil { await viewModel.load() }
        }
        .sheet(item: $duzenlenenKalem) { hedef in
            NavigationStack {
                ChecklistItemFormView(
                    kalem: hedef.kalem,
                    periyot: hedef.periyot,
                    mevcut: hedef.kalem.sonuc(hedef.periyot)
                ) { sonuc, not in
                    await viewModel.kalemKaydet(
                        templateItemId: hedef.kalem.id,
                        periyot: hedef.periyot,
                        sonuc: sonuc,
                        aciklamaNot: not
                    )
                }
            }
        }
        .sheet(isPresented: $onayaGonderGosteriliyor) {
            NavigationStack {
                ChecklistSubmitView(
                    teknisyenAdi: viewModel.form?.teknisyenAdi ?? "",
                    sefAmirAdi: viewModel.form?.sefAmirAdi ?? ""
                ) { teknisyen, sefAmir in
                    await viewModel.onayaGonder(teknisyenAdi: teknisyen, sefAmirAdi: sefAmir)
                }
            }
        }
        .sheet(isPresented: $kararGosteriliyor) {
            NavigationStack {
                ChecklistDecisionView(
                    sefAmirAdi: viewModel.form?.sefAmirAdi ?? ""
                ) { karar, sefAmir in
                    await viewModel.kararVer(karar: karar, sefAmirAdi: sefAmir)
                }
            }
        }
        .sheet(isPresented: $raporGosteriliyor) {
            if let form = viewModel.form {
                PDFPreviewSheet(
                    document: ChecklistFormPDF(form: form),
                    fileName: "kontrol-formu-\(form.plaka)-\(form.ay)-\(form.yilDonem).pdf"
                )
            }
        }
        .overlay {
            if viewModel.isLoading, viewModel.form == nil { LoadingOverlay() }
        }
    }
}

/// `sheet(item:)` için kalem + periyot çifti.
struct ChecklistItemEditTarget: Identifiable {
    let kalem: ChecklistItemDTO
    let periyot: ChecklistPeriod

    var id: String { "\(kalem.id)-\(periyot.rawValue)" }
}

/// Kalem satırı: sıra no, kontrol kalemi ve periyot rozetleri.
private struct ChecklistItemRow: View {
    let kalem: ChecklistItemDTO
    let periyotlar: [ChecklistPeriod]
    let duzenlenebilir: Bool
    let onSelect: (ChecklistPeriod) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(kalem.siraNo)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(KBTheme.muted)
                Text(kalem.kontrolKalemi)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(KBTheme.navy)
                    .fixedSize(horizontal: false, vertical: true)
            }

            LazyVGrid(
                columns: [.init(.adaptive(minimum: 92), spacing: 6)],
                spacing: 6
            ) {
                ForEach(periyotlar) { periyot in
                    ChecklistPeriodCell(
                        periyot: periyot,
                        sonuc: kalem.sonuc(periyot),
                        duzenlenebilir: duzenlenebilir,
                        onSelect: { onSelect(periyot) }
                    )
                }
            }

            if let notlar = kalem.notMetni {
                Text(notlar)
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct ChecklistPeriodCell: View {
    let periyot: ChecklistPeriod
    let sonuc: ChecklistItemResultDTO?
    let duzenlenebilir: Bool
    let onSelect: () -> Void

    private var tone: StatusBadge.Tone {
        (sonuc?.degerlendirme?.badgeTone ?? .neutral).badge
    }

    var body: some View {
        Button(action: onSelect) {
            VStack(spacing: 2) {
                Text(periyot.shortName)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(KBTheme.muted)
                if let degerlendirme = sonuc?.degerlendirme {
                    Image(systemName: degerlendirme.symbolName)
                        .font(.subheadline)
                        .foregroundStyle(tone.foreground)
                } else {
                    Image(systemName: duzenlenebilir ? "plus.circle" : "minus")
                        .font(.subheadline)
                        .foregroundStyle(KBTheme.muted.opacity(0.6))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: KBTheme.touchMin)
            .background(tone.foreground.opacity(sonuc == nil ? 0.05 : 0.12))
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
        }
        .buttonStyle(.plain)
        .disabled(!duzenlenebilir)
        .accessibilityLabel(
            "\(periyot.displayName): \(sonuc?.degerlendirme?.displayName ?? "boş")"
        )
    }
}

// MARK: - Kalem formu

private struct ChecklistItemFormView: View {
    let kalem: ChecklistItemDTO
    let periyot: ChecklistPeriod
    let mevcut: ChecklistItemResultDTO?
    let onSave: (ChecklistResult, String?) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var sonuc: ChecklistResult
    @State private var aciklamaNot: String
    @State private var isSaving = false

    init(
        kalem: ChecklistItemDTO,
        periyot: ChecklistPeriod,
        mevcut: ChecklistItemResultDTO?,
        onSave: @escaping (ChecklistResult, String?) async -> Bool
    ) {
        self.kalem = kalem
        self.periyot = periyot
        self.mevcut = mevcut
        self.onSave = onSave
        _sonuc = State(initialValue: mevcut?.degerlendirme ?? .UYGUN)
        _aciklamaNot = State(initialValue: mevcut?.aciklamaNot ?? "")
    }

    var body: some View {
        Form {
            Section {
                KBDetailRow(label: "Kontrol kalemi", value: kalem.kontrolKalemi)
                KBDetailRow(label: "Periyot", value: periyot.displayName)
            }

            Section {
                KBEnumField(title: "Sonuç", selection: $sonuc)
                KBTextField(title: "Açıklama / Not", text: $aciklamaNot, multiline: true)
            } footer: {
                if sonuc == .ARIZALI {
                    Text(
                        "Arızalı işaretlenen kalem için otomatik bir arıza onarımı "
                            + "bakım kaydı açılır."
                    )
                }
            }

            Section {
                KBFormActions(
                    saveTitle: "Kalemi Kaydet",
                    isSaving: isSaving
                ) {
                    Task {
                        isSaving = true
                        let ok = await onSave(sonuc, aciklamaNot.bosDegilse)
                        isSaving = false
                        if ok { dismiss() }
                    }
                }
            }
        }
        .navigationTitle("Kalem \(kalem.siraNo)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

// MARK: - Onaya gönderme

private struct ChecklistSubmitView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var teknisyenAdi: String
    @State private var sefAmirAdi: String
    @State private var isSaving = false

    let onSubmit: (String?, String?) async -> Bool

    init(
        teknisyenAdi: String,
        sefAmirAdi: String,
        onSubmit: @escaping (String?, String?) async -> Bool
    ) {
        _teknisyenAdi = State(initialValue: teknisyenAdi)
        _sefAmirAdi = State(initialValue: sefAmirAdi)
        self.onSubmit = onSubmit
    }

    var body: some View {
        Form {
            Section("İmza alanları") {
                KBTextField(title: "Teknisyen adı", text: $teknisyenAdi)
                KBTextField(title: "Şef / Amir", text: $sefAmirAdi)
            }
            Section {
                KBFormActions(saveTitle: "Onaya Gönder", isSaving: isSaving) {
                    Task {
                        isSaving = true
                        let ok = await onSubmit(
                            teknisyenAdi.bosDegilse,
                            sefAmirAdi.bosDegilse
                        )
                        isSaving = false
                        if ok { dismiss() }
                    }
                }
            }
        }
        .navigationTitle("Onaya Gönder")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }
}

// MARK: - Onay kararı

private struct ChecklistDecisionView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var sefAmirAdi: String
    @State private var isSaving = false

    let onDecide: (ChecklistStatus, String?) async -> Bool

    init(sefAmirAdi: String, onDecide: @escaping (ChecklistStatus, String?) async -> Bool) {
        _sefAmirAdi = State(initialValue: sefAmirAdi)
        self.onDecide = onDecide
    }

    var body: some View {
        Form {
            Section("Karar veren") {
                KBTextField(title: "Şef / Amir", text: $sefAmirAdi)
            }
            Section {
                Button("Onayla") { karar(.ONAYLANDI) }
                    .buttonStyle(KBPrimaryButtonStyle())
                    .disabled(isSaving)
                Button("Reddet") { karar(.REDDEDILDI) }
                    .buttonStyle(KBPrimaryButtonStyle(filled: false))
                    .disabled(isSaving)
                if isSaving {
                    HStack { Spacer(); ProgressView(); Spacer() }
                }
            }
        }
        .navigationTitle("Onay Kararı")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
    }

    private func karar(_ deger: ChecklistStatus) {
        Task {
            isSaving = true
            let ok = await onDecide(deger, sefAmirAdi.bosDegilse)
            isSaving = false
            if ok { dismiss() }
        }
    }
}

@MainActor
final class ChecklistDetailViewModel: ObservableObject {
    @Published private(set) var form: ChecklistDetailDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    /// Otomatik bakım kaydı / kuyruğa alma gibi bilgilendirmeler
    @Published var infoMessage: String?

    private let submissionId: String
    private let api: APIClient
    private let queue: ChecklistOfflineQueue

    init(
        submissionId: String,
        api: APIClient = .shared,
        queue: ChecklistOfflineQueue = .shared
    ) {
        self.submissionId = submissionId
        self.api = api
        self.queue = queue
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            form = try await api.fetchChecklist(id: submissionId)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    /// Bağlantı yoksa kalem kuyruğa alınır ve kullanıcıya kaydedildi bilgisi
    /// verilir; kuyruk bağlantı gelince gönderir.
    func kalemKaydet(
        templateItemId: String,
        periyot: ChecklistPeriod,
        sonuc: ChecklistResult,
        aciklamaNot: String?
    ) async -> Bool {
        errorMessage = nil
        let istek = ChecklistItemRequestDTO(
            templateItemId: templateItemId,
            periyot: periyot.rawValue,
            sonuc: sonuc.rawValue,
            aciklamaNot: aciklamaNot
        )
        do {
            let kayit = try await api.saveChecklistItem(
                submissionId: submissionId,
                istek
            )
            infoMessage = kayit.bakimKaydiId != nil
                ? "Arızalı kalem için otomatik bakım kaydı açıldı."
                : nil
            await load()
            return true
        } catch {
            if APIError.isOffline(error) {
                queue.enqueue(submissionId: submissionId, request: istek)
                infoMessage = "Bağlantı yok — kalem çevrimdışı kuyruğa alındı."
                return true
            }
            errorMessage = APIError.describe(error)
            return false
        }
    }

    func onayaGonder(teknisyenAdi: String?, sefAmirAdi: String?) async -> Bool {
        await durumIslemi {
            try await self.api.submitChecklist(
                id: self.submissionId,
                ChecklistSubmitRequestDTO(
                    teknisyenAdi: teknisyenAdi,
                    sefAmirAdi: sefAmirAdi
                )
            )
        }
    }

    func kararVer(karar: ChecklistStatus, sefAmirAdi: String?) async -> Bool {
        await durumIslemi {
            try await self.api.decideChecklist(
                id: self.submissionId,
                ChecklistDecisionRequestDTO(
                    karar: karar.rawValue,
                    sefAmirAdi: sefAmirAdi
                )
            )
        }
    }

    /// Durum geçişleri kuyruktaki kalemleri önce gönderir; aksi halde onaya
    /// giden formda kalem eksik kalır.
    private func durumIslemi(
        _ islem: @escaping () async throws -> ChecklistStateDTO
    ) async -> Bool {
        errorMessage = nil
        await queue.flush()
        if queue.pendingCount(submissionId: submissionId) > 0 {
            errorMessage = "Çevrimdışı kalemler gönderilemedi; bağlantıyı kontrol edin."
            return false
        }
        do {
            _ = try await islem()
            await load()
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

extension AppSession {
    /// Web `kontrolFormuOnayla`: ADMIN, DEPARTMENT_MANAGER, APPROVER.
    var canDecideChecklist: Bool {
        role == .ADMIN || role == .DEPARTMENT_MANAGER || role == .APPROVER
    }
}
