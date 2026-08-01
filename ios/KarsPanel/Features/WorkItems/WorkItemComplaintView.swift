import SwiftUI
import UIKit

/// `/islerim/[id]` — saha personelinin atanan şikayeti: kayıt kartı, WhatsApp
/// konuşması, cevap yazma ve durum güncelleme. Atama yönetici işi olduğu için
/// burada yoktur.
struct WorkItemComplaintView: View {
    let complaintId: String

    @StateObject private var viewModel: WorkItemComplaintViewModel
    @State private var hedefDurum: ComplaintStatus = .DEVAM_EDIYOR
    @State private var cozumNotu = ""
    @State private var cevapMetni = ""

    init(complaintId: String, api: APIClient = .shared) {
        self.complaintId = complaintId
        _viewModel = StateObject(
            wrappedValue: WorkItemComplaintViewModel(complaintId: complaintId, api: api)
        )
    }

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            if let sikayet = viewModel.sikayet {
                Section("Kayıt") {
                    KBDetailRow(label: "Şikayet No", value: sikayet.sikayetNo)
                    KBDetailRow(label: "Durum", value: sikayet.durum.label)
                    KBDetailRow(label: "Öncelik", value: sikayet.oncelik.label)
                    KBDetailRow(label: "Kanal", value: ComplaintChannel.label(sikayet.kanal))
                    KBDetailRow(label: "Kayıt tarihi", value: sikayet.kayitTarihi.kbAn)
                    KBDetailRow(label: "Şikayet türü", value: sikayet.tur)
                    KBDetailRow(label: "Müdürlük", value: sikayet.mudurluk)
                }

                Section("Vatandaş") {
                    KBDetailRow(label: "Ad Soyad", value: sikayet.arayanKisi)
                    if let telefon = sikayet.telefon, !telefon.isEmpty {
                        KBPhoneRow(telefon: telefon)
                    }
                    KBDetailRow(label: "Mahalle", value: sikayet.mahalle)
                    KBDetailRow(label: "Açık adres", value: sikayet.acikAdres)
                }

                if let aciklama = sikayet.aciklama, !aciklama.isEmpty {
                    Section("Şikayet Metni") {
                        Text(aciklama)
                            .font(.subheadline)
                            .foregroundStyle(KBTheme.navy)
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

                whatsappSection(sikayet)

                if sikayet.acikMi {
                    durumSection(sikayet)
                } else {
                    Section("Kapanış") {
                        KBDetailRow(
                            label: "Kapanış tarihi",
                            value: sikayet.kapanisTarihi.kbAn
                        )
                        KBDetailRow(label: "Çözüm notu", value: sikayet.cozumNotu)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle(viewModel.sikayet?.sikayetNo ?? "İşim")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await viewModel.load() }
        .task {
            await viewModel.load()
            if let durum = viewModel.sikayet?.durum {
                hedefDurum = durum == .ACIK ? .DEVAM_EDIYOR : durum
            }
        }
        .overlay {
            if viewModel.isLoading, viewModel.sikayet == nil { LoadingOverlay() }
        }
    }

    @ViewBuilder
    private func whatsappSection(_ sikayet: WorkItemComplaintDetailDTO) -> some View {
        Section("WhatsApp Konuşması") {
            if sikayet.mesajlar.isEmpty {
                Text("Bu şikayete bağlı WhatsApp mesajı yok.")
                    .font(.subheadline)
                    .foregroundStyle(KBTheme.muted)
            } else {
                ForEach(sikayet.mesajlar) { mesaj in
                    WorkItemMessageRow(mesaj: mesaj)
                }
            }

            if sikayet.telefon?.isEmpty == false {
                KBTextField(
                    title: "Vatandaşa cevap",
                    text: $cevapMetni,
                    placeholder: "Mesajınızı yazın…",
                    multiline: true
                )
                KBFormActions(
                    saveTitle: "WhatsApp ile Gönder",
                    isSaving: viewModel.isSendingReply,
                    isEnabled: cevapMetni.bosDegilse != nil
                ) {
                    Task {
                        if await viewModel.cevapGonder(cevapMetni) { cevapMetni = "" }
                    }
                }
                Text("Mesaj, belediye WhatsApp hattı üzerinden vatandaşa iletilir.")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            } else {
                Text("Şikayette telefon numarası olmadığı için cevap gönderilemez.")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            }
        }
    }

    @ViewBuilder
    private func durumSection(_ sikayet: WorkItemComplaintDetailDTO) -> some View {
        Section("Durum Güncelle") {
            Picker("Yeni durum", selection: $hedefDurum) {
                ForEach(WorkItemComplaintViewModel.secilebilirDurumlar, id: \.self) { durum in
                    Text(durum.label).tag(durum)
                }
            }
            .pickerStyle(.segmented)

            KBTextField(
                title: "Çözüm notu",
                text: $cozumNotu,
                placeholder: "Kapatırken doldurulması önerilir",
                multiline: true
            )

            KBFormActions(
                saveTitle: "Durumu Güncelle",
                isSaving: viewModel.isSaving,
                isEnabled: hedefDurum != sikayet.durum
            ) {
                Task {
                    await viewModel.durumGuncelle(
                        durum: hedefDurum,
                        cozumNotu: cozumNotu.bosDegilse
                    )
                }
            }
        }
    }
}

/// Gelen mesaj sola, giden mesaj sağa yatar (web'in balon düzeni).
private struct WorkItemMessageRow: View {
    let mesaj: WorkItemMessageDTO

    var body: some View {
        VStack(alignment: mesaj.gelenMi ? .leading : .trailing, spacing: 4) {
            Text(mesaj.icerik ?? "(metin yok)")
                .font(.subheadline)
                .foregroundStyle(KBTheme.navy)
                .multilineTextAlignment(mesaj.gelenMi ? .leading : .trailing)
                .padding(10)
                .background(mesaj.gelenMi ? KBTheme.background : KBTheme.navy.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))

            HStack(spacing: 4) {
                Text(mesaj.gelenMi ? "Vatandaş" : mesaj.gonderen ?? "Panel")
                if let createdAt = mesaj.createdAt {
                    Text("· \(createdAt.kbAn)")
                }
                if !mesaj.gelenMi, let durum = mesaj.gonderimEtiketi {
                    Text("· \(durum)")
                }
            }
            .font(.caption2)
            .foregroundStyle(KBTheme.muted)

            if let ek = mesaj.medyaEtiketi {
                Label(ek, systemImage: "paperclip")
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }

            if mesaj.iletilemedi {
                Text("Mesaj iletilemedi — tekrar göndermeyi deneyin.")
                    .font(.caption2)
                    .foregroundStyle(KBTheme.warning)
            }
        }
        .frame(maxWidth: .infinity, alignment: mesaj.gelenMi ? .leading : .trailing)
    }
}

/// Şikayet fotoğrafları yatay kaydırılır.
struct ComplaintPhotoStrip: View {
    let photos: [ComplaintPhotoDTO]

    @EnvironmentObject private var session: AppSession

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(photos) { photo in
                    VStack(spacing: 4) {
                        AsyncImage(url: session.mediaURL(photo.url)) { phase in
                            switch phase {
                            case let .success(image):
                                image.resizable().scaledToFill()
                            case .failure:
                                Image(systemName: "photo.badge.exclamationmark")
                                    .foregroundStyle(KBTheme.muted)
                            case .empty:
                                ProgressView()
                            @unknown default:
                                ProgressView()
                            }
                        }
                        .frame(width: 108, height: 108)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))

                        Text(photo.tipEtiketi)
                            .font(.caption2)
                            .foregroundStyle(KBTheme.muted)
                    }
                }
            }
        }
    }
}

/// Telefonu tek dokunuşla arama; sahada en sık kullanılan aksiyon.
struct KBPhoneRow: View {
    let telefon: String

    var body: some View {
        Button {
            let digits = telefon.filter { $0.isNumber || $0 == "+" }
            if let url = URL(string: "tel:\(digits)") {
                UIApplication.shared.open(url)
            }
        } label: {
            HStack {
                Text("Telefon")
                    .font(.subheadline)
                    .foregroundStyle(KBTheme.muted)
                Spacer(minLength: 12)
                Label(telefon, systemImage: "phone.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KBTheme.accent)
            }
            .frame(minHeight: KBTheme.touchMin)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(telefon) numarasını ara")
    }
}

@MainActor
final class WorkItemComplaintViewModel: ObservableObject {
    /// Saha personeli iptal edemez; web formu da yalnız bu üç durumu sunar.
    static let secilebilirDurumlar: [ComplaintStatus] = [.ACIK, .DEVAM_EDIYOR, .KAPATILDI]

    @Published private(set) var sikayet: WorkItemComplaintDetailDTO?
    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published private(set) var isSendingReply = false
    @Published var errorMessage: String?

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
            sikayet = try await api.fetchWorkItemComplaint(id: complaintId)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func durumGuncelle(durum: ComplaintStatus, cozumNotu: String?) async {
        isSaving = true
        errorMessage = nil
        do {
            try await api.updateWorkItemComplaintStatus(
                id: complaintId,
                durum: durum,
                cozumNotu: cozumNotu
            )
            await load()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isSaving = false
    }

    func cevapGonder(_ text: String) async -> Bool {
        guard let metin = text.bosDegilse else { return false }
        isSendingReply = true
        errorMessage = nil
        defer { isSendingReply = false }
        do {
            try await api.replyOnWhatsApp(complaintId: complaintId, text: metin)
            await load()
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }
}

extension ComplaintPhotoDTO {
    var tipEtiketi: String {
        switch tip {
        case "VATANDAS": return "Vatandaş"
        case "COZUM": return "Çözüm"
        default: return tip ?? "Fotoğraf"
        }
    }
}

extension WorkItemMessageDTO {
    /// Web `GONDERIM_LABELS` ile aynı metinler.
    var gonderimEtiketi: String? {
        switch gonderimDurumu {
        case "KUYRUKTA": return "gönderiliyor"
        case "GONDERILDI": return "iletildi"
        case "BASARISIZ": return "iletilemedi"
        default: return gonderimDurumu
        }
    }

    var iletilemedi: Bool { gonderimDurumu == "BASARISIZ" }

    /// Medya indirme yetkilendirme gerektirdiği için yalnızca varlığı belirtilir.
    var medyaEtiketi: String? {
        guard medyaUrl != nil else { return nil }
        return "Medya eki (\(medyaTipi ?? "bilinmiyor"))"
    }
}

/// `Kanal` enum etiketleri (web `KANAL_LABELS`).
enum ComplaintChannel {
    static func label(_ raw: String?) -> String? {
        switch raw {
        case "TELEFON": return "Telefon"
        case "WHATSAPP": return "WhatsApp"
        case "WEB": return "Web"
        default: return raw
        }
    }
}
