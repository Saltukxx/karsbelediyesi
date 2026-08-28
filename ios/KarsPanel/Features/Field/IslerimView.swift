import SwiftUI

/// Saha rollerinin ana ekranı: kendisine atanan şikayetler ve asfalt rotaları.
struct IslerimView: View {
    @StateObject private var store = KBListStore { [try await APIClient.shared.fetchIslerim()] }
    @State private var cevapIcin: ComplaintDTO?
    @State private var confirm: KBConfirmRequest?

    private var veri: IslerimDTO? { store.items.first }
    private var sikayetler: [ComplaintDTO] { veri?.sikayetler ?? [] }
    private var asfalt: [AsfaltJobDTO] { veri?.asfalt ?? [] }

    var body: some View {
        KBScreen(
            title: "İşlerim",
            description: "Size atanan şikayetler ve saha işleri.",
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: sikayetler.isEmpty && asfalt.isEmpty,
            empty: KBEmptyConfig(
                title: "Atanmış iş yok",
                systemImage: "checkmark.circle.fill",
                message: "Şu anda size atanmış açık bir iş bulunmuyor. Aşağı çekerek yenileyin."
            ),
            refresh: { await store.load() }
        ) {
            if !sikayetler.isEmpty {
                KBSectionHeader(title: "Atanan şikayetler", trailing: "\(sikayetler.count) kayıt")
                ForEach(sikayetler) { sikayet in
                    KBRecordCard(
                        title: sikayet.sikayetNo ?? sikayet.id,
                        badges: sikayetRozetleri(sikayet),
                        subtitle: sikayet.aciklama ?? sikayet.arayanKisi,
                        meta: sikayetMeta(sikayet),
                        actions: sikayetAksiyonlari(sikayet),
                        accent: sikayet.durum == .KAPATILDI ? KBTheme.success : KBTheme.warning
                    )
                }
            }

            if !asfalt.isEmpty {
                KBSectionHeader(title: "Asfalt rotaları", trailing: "\(asfalt.count) rota")
                ForEach(asfalt) { is_ in
                    KBRecordCard(
                        title: is_.ad ?? is_.id,
                        badges: [KBStatus.gorev(is_.durum)].compactMap { $0 },
                        subtitle: is_.koordinatlar.map { "\($0.count) nokta çizildi" },
                        actions: asfaltAksiyonlari(is_),
                        accent: KBTheme.accent
                    )
                }
            }
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .kbConfirm($confirm)
        .sheet(item: $cevapIcin) { sikayet in
            WhatsAppReplySheet(store: store, sikayet: sikayet) { cevapIcin = nil }
        }
    }

    private func sikayetRozetleri(_ sikayet: ComplaintDTO) -> [KBBadge] {
        var rozetler: [KBBadge] = []
        if let durum = sikayet.durum {
            rozetler.append(KBBadge(text: durum.label, tone: durum.badgeTone))
        }
        if let oncelik = sikayet.oncelik, oncelik != .NORMAL {
            rozetler.append(KBBadge(text: oncelik.label, tone: oncelik.badgeTone))
        }
        return rozetler
    }

    private func sikayetMeta(_ sikayet: ComplaintDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let tur = sikayet.complaintType?.name {
            chips.append(KBMetaChip(icon: "tag", text: tur))
        }
        if let kisi = sikayet.arayanKisi, !kisi.isEmpty {
            chips.append(KBMetaChip(icon: "person", text: kisi))
        }
        return chips
    }

    private func sikayetAksiyonlari(_ sikayet: ComplaintDTO) -> [KBRecordAction] {
        guard sikayet.durum != .KAPATILDI else {
            return [cevapAksiyonu(sikayet)]
        }
        return [
            KBRecordAction(id: "\(sikayet.id)-devam", title: "Devam", icon: "play.fill") {
                Task { await durumGuncelle(sikayet, "DEVAM_EDIYOR", mesaj: "Şikayet devam ediyor olarak işaretlendi") }
            },
            KBRecordAction(id: "\(sikayet.id)-kapat", title: "Kapat", icon: "checkmark", kind: .primary) {
                confirm = KBConfirmRequest(
                    title: "Şikayet kapatılsın mı?",
                    message: "\(sikayet.sikayetNo ?? "Kayıt") çözüldü olarak işaretlenecek.",
                    confirmTitle: "Kapat",
                    destructive: false
                ) {
                    Task { await durumGuncelle(sikayet, "KAPATILDI", mesaj: "Şikayet kapatıldı") }
                }
            },
            cevapAksiyonu(sikayet),
        ]
    }

    private func cevapAksiyonu(_ sikayet: ComplaintDTO) -> KBRecordAction {
        KBRecordAction(id: "\(sikayet.id)-cevap", title: "Cevap", icon: "bubble.left.fill") {
            cevapIcin = sikayet
        }
    }

    private func asfaltAksiyonlari(_ is_: AsfaltJobDTO) -> [KBRecordAction] {
        guard is_.durum?.uppercased() != "TAMAMLANDI" else { return [] }
        return [
            KBRecordAction(id: "\(is_.id)-devam", title: "Devam", icon: "play.fill") {
                Task {
                    await store.mutate(success: "Rota devam ediyor") {
                        try await APIClient.shared.updateIslerimAsfalt(id: is_.id, durum: "DEVAM_EDIYOR")
                    }
                }
            },
            KBRecordAction(id: "\(is_.id)-bitir", title: "Bitir", icon: "checkmark", kind: .primary) {
                Task {
                    await store.mutate(success: "Rota tamamlandı") {
                        try await APIClient.shared.updateIslerimAsfalt(id: is_.id, durum: "TAMAMLANDI")
                    }
                }
            },
        ]
    }

    private func durumGuncelle(_ sikayet: ComplaintDTO, _ durum: String, mesaj: String) async {
        await store.mutate(success: mesaj) {
            try await APIClient.shared.updateIslerimComplaint(
                id: sikayet.id,
                durum: durum,
                cozumNotu: nil,
                photos: nil
            )
        }
    }
}

private struct WhatsAppReplySheet: View {
    @ObservedObject var store: KBListStore<IslerimDTO>
    let sikayet: ComplaintDTO
    let onClose: () -> Void

    @State private var metin = ""

    var body: some View {
        KBFormSheet(
            title: "WhatsApp Cevabı",
            subtitle: sikayet.sikayetNo,
            submitTitle: "Cevabı Gönder",
            canSubmit: !metin.trimmingCharacters(in: .whitespaces).isEmpty,
            isSubmitting: store.isSubmitting,
            errorMessage: store.errorMessage,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            KBFormTextField(
                title: "Mesaj",
                required: true,
                placeholder: "Vatandaşa iletilecek mesaj...",
                text: $metin,
                multiline: true
            )
        }
    }

    private func gonder() {
        Task {
            let ok = await store.mutate(success: "Cevap gönderildi") {
                try await APIClient.shared.replyWhatsApp(complaintId: sikayet.id, text: metin)
            }
            if ok { onClose() }
        }
    }
}
