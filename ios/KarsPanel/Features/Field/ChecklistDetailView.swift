import SwiftUI

struct ChecklistDetailView: View {
    let id: String
    var baslik: String?

    @StateObject private var store: KBListStore<ChecklistDetailDTO>
    /// Anahtar: "\(itemId):\(periyot)" — API sonuçlarıyla hydrate edilir.
    @State private var sonuclar: [String: ChecklistSonuc] = [:]
    @State private var periyot: ChecklistPeriyot = .HAFTA_1
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
            refresh: {
                await store.load()
                hydrate()
            }
        ) {
            ilerlemeKarti
            periyotSecici

            KBSectionHeader(
                title: "Kontrol kalemleri",
                trailing: "\(isaretliSayisi)/\(kalemler.count) · \(periyot.label)"
            )
            ForEach(kalemler) { kalem in
                ChecklistItemRow(
                    baslik: kalem.kontrolKalemi ?? kalem.id,
                    secim: sonuclar[anahtar(kalem.id)]
                ) { sonuc in
                    Task { await kaydet(kalem, sonuc) }
                }
            }

            onayAksiyonlari
        }
        .task {
            await store.loadIfNeeded()
            hydrate()
        }
        .onChange(of: store.isLoading) { _, loading in
            if !loading { hydrate() }
        }
        .kbToast($store.toastMessage)
        .kbConfirm($confirm)
    }

    private var aciklama: String? {
        guard let durum = KBStatus.kontrolFormu(detay?.durum) else { return nil }
        return "Form durumu: \(durum.text)"
    }

    private func anahtar(_ itemId: String) -> String { "\(itemId):\(periyot.rawValue)" }

    private var isaretliSayisi: Int {
        kalemler.filter { sonuclar[anahtar($0.id)] != nil }.count
    }

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

    private var periyotSecici: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kontrol periyodu")
                .font(.caption.weight(.semibold))
                .foregroundStyle(KBTheme.muted)
            KBChipRow(
                selection: $periyot,
                items: ChecklistPeriyot.allCases.map {
                    KBChipItem(value: $0, label: $0.kisa, count: periyotSayisi($0))
                }
            )
        }
    }

    private func periyotSayisi(_ p: ChecklistPeriyot) -> Int {
        kalemler.filter { sonuclar["\($0.id):\(p.rawValue)"] != nil }.count
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

    private func hydrate() {
        guard let items = detay?.items else { return }
        var map = sonuclar
        for item in items {
            for result in item.results ?? [] {
                guard let periyot = result.periyot,
                      let raw = result.sonuc,
                      let sonuc = ChecklistSonuc(rawValue: raw) else { continue }
                map["\(item.id):\(periyot)"] = sonuc
            }
        }
        sonuclar = map
    }

    private func kaydet(_ kalem: ChecklistItemDTO, _ sonuc: ChecklistSonuc) async {
        let key = anahtar(kalem.id)
        let onceki = sonuclar[key]
        sonuclar[key] = sonuc
        let ok = await store.mutate {
            try await APIClient.shared.patchChecklist(
                id: id,
                action: "item",
                extra: [
                    "templateItemId": kalem.id,
                    "periyot": periyot.rawValue,
                    "sonuc": sonuc.rawValue,
                ]
            )
        }
        if !ok { sonuclar[key] = onceki }
    }

    private func formIslem(_ action: String, mesaj: String) async {
        await store.mutate(success: mesaj) {
            try await APIClient.shared.patchChecklist(id: id, action: action)
        }
    }
}

enum ChecklistPeriyot: String, CaseIterable, Hashable {
    case HAFTA_1, HAFTA_2, HAFTA_3, HAFTA_4, AYLIK_BAKIM

    var label: String {
        switch self {
        case .HAFTA_1: return "1. Hafta"
        case .HAFTA_2: return "2. Hafta"
        case .HAFTA_3: return "3. Hafta"
        case .HAFTA_4: return "4. Hafta"
        case .AYLIK_BAKIM: return "Aylık bakım"
        }
    }

    var kisa: String {
        switch self {
        case .HAFTA_1: return "H1"
        case .HAFTA_2: return "H2"
        case .HAFTA_3: return "H3"
        case .HAFTA_4: return "H4"
        case .AYLIK_BAKIM: return "Aylık"
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
