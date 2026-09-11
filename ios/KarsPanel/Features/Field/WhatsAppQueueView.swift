import AVFoundation
import SwiftUI
import UIKit

struct WhatsAppQueueView: View {
    @StateObject private var store = KBListStore(pageSize: 100) { limit in
        try await APIClient.shared.fetchWhatsAppQueue(limit: limit)
    }
    @State private var arama = ""
    @State private var confirm: KBConfirmRequest?
    @State private var medyaMesaj: WhatsAppMessageDTO?

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "WhatsApp Kuyruğu",
            description: "Bota gelen mesajların şikayete dönüştürülme onayı.",
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Bekleyen mesaj yok" : "Aramaya uyan mesaj yok",
                systemImage: "message.fill",
                message: store.isEmpty
                    ? "Onay bekleyen WhatsApp mesajı bulunmuyor."
                    : "Farklı bir telefon veya içerik araması deneyin."
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                KBStatGrid {
                    KBStatCard(
                        value: "\(bekleyenSayisi)",
                        label: "Onay bekleyen",
                        icon: "clock.badge.exclamationmark.fill",
                        tone: bekleyenSayisi > 0 ? KBTheme.warning : KBTheme.success
                    )
                    KBStatCard(
                        value: "\(store.items.count)",
                        label: "Toplam mesaj",
                        icon: "message.fill"
                    )
                }
            }
            KBSearchField(text: $arama, placeholder: "Telefon veya mesaj ara...")

            ForEach(liste) { mesaj in
                KBRecordCard(
                    title: mesaj.telefon ?? "Bilinmeyen numara",
                    badges: rozetler(mesaj),
                    subtitle: mesaj.icerik,
                    meta: meta(mesaj),
                    actions: aksiyonlar(mesaj),
                    accent: vurgu(mesaj)
                )
            }

            KBLoadMoreRow(store: store, birim: "mesaj")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .kbConfirm($confirm)
        .sheet(item: $medyaMesaj) { mesaj in
            WhatsAppMediaSheet(mesaj: mesaj) { medyaMesaj = nil }
        }
    }

    private var bekleyenSayisi: Int {
        store.items.filter { $0.onayDurumu?.uppercased() == "ONAY_BEKLIYOR" }.count
    }

    private var gorunen: [WhatsAppMessageDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        guard !sorgu.isEmpty else { return store.items }
        return store.items.filter { mesaj in
            [mesaj.telefon, mesaj.icerik].contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func rozetler(_ mesaj: WhatsAppMessageDTO) -> [KBBadge] {
        var rozetler = [KBStatus.whatsappOnay(mesaj.onayDurumu)].compactMap { $0 }
        if let guven = mesaj.guven {
            let yuzde = Int((guven <= 1 ? guven * 100 : guven).rounded())
            rozetler.append(KBBadge(text: "%\(yuzde) güven", tone: yuzde >= 70 ? .success : .warning))
        }
        return rozetler
    }

    private func meta(_ mesaj: WhatsAppMessageDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let tarih = KBFormat.tarih(mesaj.createdAt) {
            chips.append(KBMetaChip(icon: "calendar", text: tarih))
        }
        if let yon = mesaj.yon {
            chips.append(KBMetaChip(icon: yon.uppercased() == "GELEN" ? "arrow.down.left" : "arrow.up.right", text: yon.capitalized))
        }
        if mesaj.medyaVar {
            let tip = (mesaj.medyaTipi ?? "medya").lowercased()
            chips.append(KBMetaChip(icon: tip == "audio" ? "waveform" : "photo", text: tip == "audio" ? "Ses" : "Görsel"))
        }
        return chips
    }

    private func aksiyonlar(_ mesaj: WhatsAppMessageDTO) -> [KBRecordAction] {
        var aksiyonlar: [KBRecordAction] = []
        if mesaj.medyaVar {
            let tip = (mesaj.medyaTipi ?? "").lowercased()
            aksiyonlar.append(
                KBRecordAction(
                    id: "\(mesaj.id)-medya",
                    title: tip == "audio" ? "Ses" : "Medya",
                    icon: tip == "audio" ? "waveform" : "photo",
                    kind: .normal
                ) {
                    medyaMesaj = mesaj
                }
            )
        }
        guard mesaj.onayDurumu?.uppercased() == "ONAY_BEKLIYOR" else { return aksiyonlar }
        aksiyonlar += [
            KBRecordAction(id: "\(mesaj.id)-onay", title: "Onayla", icon: "checkmark", kind: .primary) {
                Task {
                    await store.mutate(success: "Mesaj onaylandı") {
                        _ = try await APIClient.shared.updateWhatsApp(id: mesaj.id, action: "approve")
                    }
                }
            },
            KBRecordAction(id: "\(mesaj.id)-red", title: "Reddet", icon: "xmark", kind: .destructive) {
                confirm = KBConfirmRequest(
                    title: "Mesaj reddedilsin mi?",
                    message: "Bu mesaj şikayete dönüştürülmeyecek.",
                    confirmTitle: "Reddet"
                ) {
                    Task {
                        await store.mutate(success: "Mesaj reddedildi") {
                            _ = try await APIClient.shared.updateWhatsApp(id: mesaj.id, action: "reject")
                        }
                    }
                }
            },
        ]
        return aksiyonlar
    }

    private func vurgu(_ mesaj: WhatsAppMessageDTO) -> Color {
        switch mesaj.onayDurumu?.uppercased() {
        case "ONAY_BEKLIYOR": return KBTheme.warning
        case "ONAYLANDI": return KBTheme.success
        case "REDDEDILDI": return KBTheme.danger
        default: return KBTheme.navy
        }
    }
}

private struct WhatsAppMediaSheet: View {
    let mesaj: WhatsAppMessageDTO
    let onClose: () -> Void

    @State private var image: UIImage?
    @State private var audioURL: URL?
    @State private var hata: String?
    @State private var yukleniyor = true

    private var isAudio: Bool {
        (mesaj.medyaTipi ?? "").lowercased() == "audio"
    }

    var body: some View {
        NavigationStack {
            Group {
                if yukleniyor {
                    ProgressView("Medya yükleniyor…")
                } else if let audioURL {
                    KBAudioPlayerView(fileURL: audioURL)
                } else if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .padding()
                } else if let hata {
                    Text(hata)
                        .foregroundStyle(KBTheme.danger)
                        .multilineTextAlignment(.center)
                        .padding()
                } else {
                    Text("Medya önizlemesi yok.")
                        .foregroundStyle(KBTheme.muted)
                        .padding()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle(isAudio ? "WhatsApp Ses" : "WhatsApp Medya")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat", action: kapat)
                }
            }
        }
        .task { await yukle() }
        .onDisappear { temizleGeciciSes() }
    }

    private func kapat() {
        temizleGeciciSes()
        onClose()
    }

    private func temizleGeciciSes() {
        if let audioURL {
            try? FileManager.default.removeItem(at: audioURL)
            self.audioURL = nil
        }
    }

    private func yukle() async {
        yukleniyor = true
        hata = nil
        image = nil
        temizleGeciciSes()
        defer { yukleniyor = false }
        do {
            let data = try await APIClient.shared.fetchWhatsAppMedia(id: mesaj.id)
            guard !data.isEmpty else {
                hata = "Medya dosyası bulunamadı veya boş."
                return
            }
            if isAudio || !dataLooksLikeImage(data) && isLikelyAudio(data) {
                let ext = audioExtension(for: data)
                let url = FileManager.default.temporaryDirectory
                    .appendingPathComponent("wa-\(mesaj.id).\(ext)")
                try data.write(to: url, options: .atomic)
                audioURL = url
            } else if let img = UIImage(data: data) {
                image = img
            } else if isAudio {
                hata = "Ses dosyası indirildi ama oynatılamadı (\(data.count) bayt)."
            } else {
                hata = "Dosya açılamadı (\(data.count) bayt)."
            }
        } catch is CancellationError {
        } catch {
            hata = KBErrorText.of(error)
        }
    }

    private func dataLooksLikeImage(_ data: Data) -> Bool {
        UIImage(data: data) != nil
    }

    private func isLikelyAudio(_ data: Data) -> Bool {
        // OGG/Opus (WhatsApp ses) veya MP4/M4A/MP3 imzaları
        if data.count >= 4 {
            let b = [UInt8](data.prefix(4))
            if b[0] == 0x4F && b[1] == 0x67 && b[2] == 0x67 && b[3] == 0x53 { return true } // OggS
            if b[0] == 0x49 && b[1] == 0x44 && b[2] == 0x33 { return true } // ID3
            if b[0] == 0xFF && (b[1] & 0xE0) == 0xE0 { return true } // MPEG frame
        }
        if data.count >= 8 {
            let box = String(data: data.subdata(in: 4..<8), encoding: .ascii) ?? ""
            if box == "ftyp" { return true }
        }
        return isAudio
    }

    private func audioExtension(for data: Data) -> String {
        if data.count >= 4 {
            let b = [UInt8](data.prefix(4))
            if b[0] == 0x4F && b[1] == 0x67 && b[2] == 0x67 && b[3] == 0x53 { return "ogg" }
            if b[0] == 0x49 && b[1] == 0x44 && b[2] == 0x33 { return "mp3" }
        }
        if data.count >= 8 {
            let box = String(data: data.subdata(in: 4..<8), encoding: .ascii) ?? ""
            if box == "ftyp" { return "m4a" }
        }
        return "m4a"
    }
}
