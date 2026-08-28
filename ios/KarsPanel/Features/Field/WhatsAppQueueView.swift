import SwiftUI

struct WhatsAppQueueView: View {
    @StateObject private var store = KBListStore(pageSize: 100) { limit in
        try await APIClient.shared.fetchWhatsAppQueue(limit: limit)
    }
    @State private var arama = ""
    @State private var confirm: KBConfirmRequest?

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
        return chips
    }

    private func aksiyonlar(_ mesaj: WhatsAppMessageDTO) -> [KBRecordAction] {
        guard mesaj.onayDurumu?.uppercased() == "ONAY_BEKLIYOR" else { return [] }
        return [
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
