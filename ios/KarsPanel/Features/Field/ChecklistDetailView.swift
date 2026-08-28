import SwiftUI

struct ChecklistDetailView: View {
    let id: String
    var baslik: String?

    @StateObject private var store: KBListStore<ChecklistDetailDTO>
    /// API kalem sonuçlarını geri döndürmediği için seçim bu oturumda yerel tutulur.
    @State private var sonuclar: [String: ChecklistSonuc] = [:]
    @State private var confirm: KBConfirmRequest?

    init(id: String, baslik: String? = nil) {
        self.id = id
        self.baslik = baslik
        _store = StateObject(wrappedValue: KBListStore {
            [try await APIClient.shared.fetchChecklistDetail(id: id)]
        })
    }

    private var detay: ChecklistDetailDTO? { store.items.first }
    private var kalemler: [ChecklistItemDTO] { detay?.items ?? [] }

    var body: some View {
        KBScreen(
            title: detay?.sablonAdi ?? baslik ?? "Kontrol Formu",
            description: aciklama,
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: kalemler.isEmpty,
            empty: KBEmptyConfig(
                title: "Kontrol kalemi yok",
                systemImage: "checklist",
                message: "Bu şablonda tanımlı kontrol kalemi bulunmuyor."
            ),
            refresh: { await store.load() }
        ) {
            ilerlemeKarti

            KBSectionHeader(title: "Kontrol kalemleri", trailing: "\(isaretliSayisi)/\(kalemler.count)")
            ForEach(kalemler) { kalem in
                ChecklistItemRow(
                    baslik: kalem.kontrolKalemi ?? kalem.id,
                    secim: sonuclar[kalem.id]
                ) { sonuc in
                    Task { await kaydet(kalem, sonuc) }
                }
            }

            onayAksiyonlari
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .kbConfirm($confirm)
    }

    private var aciklama: String? {
        guard let durum = KBStatus.kontrolFormu(detay?.durum) else { return nil }
        return "Form durumu: \(durum.text)"
    }

    private var isaretliSayisi: Int { sonuclar.count }

    private var ilerlemeKarti: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Doldurma ilerlemesi")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
                Spacer()
                if let durum = KBStatus.kontrolFormu(detay?.durum) {
                    StatusBadge(text: durum.text, tone: durum.tone)
                }
            }
            ProgressView(value: oran)
                .tint(KBTheme.action)
            Text("\(isaretliSayisi) kalem işaretlendi, \(max(kalemler.count - isaretliSayisi, 0)) kalem bekliyor.")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)
        }
        .kbCard()
    }

    private var oran: Double {
        guard !kalemler.isEmpty else { return 0 }
        return Double(isaretliSayisi) / Double(kalemler.count)
    }

    @ViewBuilder
    private var onayAksiyonlari: some View {
        VStack(spacing: 10) {
            Button("Onaya Gönder") {
                confirm = KBConfirmRequest(
                    title: "Form onaya gönderilsin mi?",
                    message: "İşaretlenmemiş kalemler boş kalacak.",
                    confirmTitle: "Gönder",
                    destructive: false
                ) {
                    Task { await formIslem("submit", mesaj: "Form onaya gönderildi") }
                }
            }
            .buttonStyle(KBPrimaryButtonStyle())

            Button("Onayla") {
                Task { await formIslem("approve", mesaj: "Form onaylandı") }
            }
            .buttonStyle(KBPrimaryButtonStyle(filled: false))
        }
        .padding(.top, 4)
    }

    private func kaydet(_ kalem: ChecklistItemDTO, _ sonuc: ChecklistSonuc) async {
        let onceki = sonuclar[kalem.id]
        sonuclar[kalem.id] = sonuc
        let ok = await store.mutate {
            try await APIClient.shared.patchChecklist(
                id: id,
                action: "item",
                extra: ["templateItemId": kalem.id, "periyot": "HAFTA_1", "sonuc": sonuc.rawValue]
            )
        }
        if !ok { sonuclar[kalem.id] = onceki }
    }

    private func formIslem(_ action: String, mesaj: String) async {
        await store.mutate(success: mesaj) {
            try await APIClient.shared.patchChecklist(id: id, action: action)
        }
    }
}

enum ChecklistSonuc: String, CaseIterable {
    case UYGUN
    case ARIZALI

    var label: String {
        switch self {
        case .UYGUN: return "Uygun"
        case .ARIZALI: return "Arızalı"
        }
    }

    var tone: Color {
        switch self {
        case .UYGUN: return KBTheme.success
        case .ARIZALI: return KBTheme.danger
        }
    }

    var icon: String {
        switch self {
        case .UYGUN: return "checkmark.circle.fill"
        case .ARIZALI: return "exclamationmark.triangle.fill"
        }
    }
}

private struct ChecklistItemRow: View {
    let baslik: String
    let secim: ChecklistSonuc?
    let onSelect: (ChecklistSonuc) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(baslik)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(KBTheme.navy)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                ForEach(ChecklistSonuc.allCases, id: \.self) { sonuc in
                    let secili = secim == sonuc
                    Button {
                        onSelect(sonuc)
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: sonuc.icon)
                                .font(.system(size: 11, weight: .bold))
                            Text(sonuc.label)
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(secili ? .white : sonuc.tone)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 36)
                        .background(secili ? sonuc.tone : sonuc.tone.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(secili ? .isSelected : [])
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                .stroke(secim == nil ? KBTheme.border : secim!.tone.opacity(0.35), lineWidth: 1)
        )
    }
}
