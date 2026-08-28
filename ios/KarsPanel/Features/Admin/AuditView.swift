import SwiftUI

struct AuditView: View {
    @StateObject private var store = KBListStore(pageSize: 200) { limit in
        try await APIClient.shared.fetchAudit(limit: limit)
    }
    @State private var arama = ""
    @State private var kategori = DenetimKategori.tumu

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Denetim İzi",
            description: "Kullanıcı işlemlerinin kronolojik kaydı.",
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: store.isEmpty ? "Denetim kaydı yok" : "Filtreye uyan kayıt yok",
                systemImage: "checkmark.shield.fill",
                message: store.isEmpty
                    ? "Sistemde işlem yapıldıkça denetim izi burada birikir."
                    : "Arama veya kategori filtresini değiştirin."
            ),
            refresh: { await store.load() }
        ) {
            KBSearchField(text: $arama, placeholder: "Kullanıcı, işlem veya varlık ara...")
            KBChipRow(selection: $kategori, items: cipler)

            ForEach(liste) { satir in
                let rozet = KBStatus.denetimIslem(satir.islem)
                // Rozet metni başlıkla aynı olacağı için rozete varlık türü basılır.
                KBRecordCard(
                    title: rozet?.text ?? satir.islem ?? satir.id,
                    badges: KBStatus.varlikAdi(satir.varlik).map { [KBBadge(text: $0, tone: .neutral)] } ?? [],
                    meta: meta(satir),
                    accent: vurgu(rozet)
                )
            }

            KBLoadMoreRow(store: store, birim: "kayıt")
        }
        .task { await store.loadIfNeeded() }
    }

    private var cipler: [KBChipItem<DenetimKategori>] {
        DenetimKategori.allCases.map { filtre in
            KBChipItem(
                value: filtre,
                label: filtre.label,
                count: store.items.filter { filtre.matches($0) }.count
            )
        }
    }

    private var gorunen: [AuditRowDTO] {
        let sorgu = arama.trimmingCharacters(in: .whitespaces)
        return store.items.filter { satir in
            guard kategori.matches(satir) else { return false }
            guard !sorgu.isEmpty else { return true }
            let etiket = KBStatus.denetimIslem(satir.islem)?.text
            return [satir.userAd, satir.islem, satir.varlik, etiket]
                .contains { KBSearch.eslesir($0, sorgu) }
        }
    }

    private func meta(_ satir: AuditRowDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let kullanici = satir.userAd, !kullanici.isEmpty {
            chips.append(KBMetaChip(icon: "person", text: kullanici))
        }
        if let rol = satir.rol, !rol.isEmpty {
            chips.append(KBMetaChip(icon: "lock.shield", text: rol))
        }
        if let tarih = KBFormat.tarih(satir.createdAt) {
            chips.append(KBMetaChip(icon: "calendar", text: tarih))
        }
        return chips
    }

    private func vurgu(_ rozet: KBBadge?) -> Color {
        switch rozet?.tone {
        case .danger: return KBTheme.danger
        case .warning: return KBTheme.warning
        case .success: return KBTheme.success
        case .accent: return KBTheme.accent
        default: return KBTheme.info
        }
    }
}

enum DenetimKategori: String, CaseIterable, Hashable {
    case tumu, oturum, sikayet, gorev, kontrol

    var label: String {
        switch self {
        case .tumu: return "Tümü"
        case .oturum: return "Oturum"
        case .sikayet: return "Şikayet"
        case .gorev: return "Görev"
        case .kontrol: return "Kontrol"
        }
    }

    func matches(_ satir: AuditRowDTO) -> Bool {
        let islem = (satir.islem ?? "").uppercased()
        switch self {
        case .tumu: return true
        case .oturum: return islem.hasPrefix("GIRIS")
        case .sikayet: return islem.hasPrefix("SIKAYET")
        case .gorev: return islem.hasPrefix("GOREV")
        case .kontrol: return islem.hasPrefix("KONTROL")
        }
    }
}
