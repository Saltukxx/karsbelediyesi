import SwiftUI

struct WorkLogsView: View {
    @StateObject private var store = KBListStore(pageSize: 100) { limit in
        try await APIClient.shared.fetchWorkLogs(limit: limit)
    }
    @State private var sekme = MesaiSekmesi.personel
    @State private var showCreate = false

    var body: some View {
        // Filtreleme her gövde değerlendirmesinde tekrarlamasın.
        let liste = gorunen

        KBScreen(
            title: "Günlük Çalışma",
            description: "Personel ve araç mesai kayıtları.",
            action: KBHeaderAction(title: "Kayıt Gir") { showCreate = true },
            isLoading: store.isLoading,
            errorMessage: store.errorMessage,
            isEmpty: liste.isEmpty,
            empty: KBEmptyConfig(
                title: sekme == .personel ? "Personel mesaisi yok" : "Araç mesaisi yok",
                systemImage: "clock.fill",
                message: "Bu sekmede kayıt bulunmuyor. Sağ üstten yeni kayıt girebilirsiniz.",
                actionTitle: "Kayıt Gir",
                action: { showCreate = true }
            ),
            refresh: { await store.load() }
        ) {
            ozet(liste)
            KBSegmentedTabs(selection: $sekme, items: sekmeler)

            ForEach(liste) { kayit in
                KBRecordCard(
                    title: baslik(kayit),
                    badges: [KBStatus.gorev(kayit.durum)].compactMap { $0 },
                    subtitle: calismaAraligi(kayit),
                    meta: meta(kayit),
                    accent: sekme == .personel ? KBTheme.navy : KBTheme.info
                )
            }

            KBLoadMoreRow(store: store, birim: "kayıt")
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .sheet(isPresented: $showCreate) {
            WorkLogCreateSheet(store: store, sekme: sekme) { showCreate = false }
        }
    }

    private func ozet(_ liste: [WorkLogDTO]) -> some View {
        KBStatGrid {
            KBStatCard(
                value: "\(liste.count)",
                label: sekme == .personel ? "Personel kaydı" : "Araç kaydı",
                icon: sekme == .personel ? "person.fill" : "car.fill"
            )
            KBStatCard(
                value: KBFormat.sayi(toplamSaat(liste), birim: "saat") ?? "0",
                label: "Toplam çalışma",
                icon: "clock.fill",
                tone: KBTheme.accent
            )
        }
    }

    private var sekmeler: [KBTabItem<MesaiSekmesi>] {
        MesaiSekmesi.allCases.map { KBTabItem(value: $0, label: $0.label) }
    }

    private var gorunen: [WorkLogDTO] {
        store.items.filter { sekme.matches($0) }
    }

    private func toplamSaat(_ liste: [WorkLogDTO]) -> Double {
        liste.reduce(0) { $0 + MesaiHesap.saat(baslangic: $1.baslangic, bitis: $1.bitis) }
    }

    private func baslik(_ kayit: WorkLogDTO) -> String {
        switch sekme {
        case .personel: return kayit.personelAdi ?? "Personel"
        case .arac: return kayit.plaka ?? "Araç"
        }
    }

    private func calismaAraligi(_ kayit: WorkLogDTO) -> String? {
        guard let bas = KBFormat.saat(kayit.baslangic) else { return nil }
        guard let bit = KBFormat.saat(kayit.bitis) else { return "Giriş \(bas)" }
        return "\(bas) – \(bit)"
    }

    private func meta(_ kayit: WorkLogDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let tarih = KBFormat.tarih(kayit.tarih) {
            chips.append(KBMetaChip(icon: "calendar", text: tarih))
        }
        let saat = MesaiHesap.saat(baslangic: kayit.baslangic, bitis: kayit.bitis)
        if saat > 0, let metin = KBFormat.sayi(saat, birim: "saat") {
            chips.append(KBMetaChip(icon: "clock", text: metin))
        }
        // Personel sekmesinde araç, araç sekmesinde personel bağlamı yardımcı bilgidir.
        switch sekme {
        case .personel:
            if let plaka = kayit.plaka { chips.append(KBMetaChip(icon: "car", text: plaka)) }
        case .arac:
            if let ad = kayit.personelAdi { chips.append(KBMetaChip(icon: "person", text: ad)) }
        }
        return chips
    }
}

enum MesaiSekmesi: String, CaseIterable, Hashable {
    case personel, arac

    var label: String {
        switch self {
        case .personel: return "Personel"
        case .arac: return "Araç"
        }
    }

    func matches(_ kayit: WorkLogDTO) -> Bool {
        switch self {
        case .personel: return kayit.personelAdi != nil
        case .arac: return kayit.personelAdi == nil && kayit.plaka != nil
        }
    }
}

/// "08:00"–"17:00" biçimindeki saat alanlarından çalışma süresini çıkarır.
enum MesaiHesap {
    static func saat(baslangic: String?, bitis: String?) -> Double {
        guard let bas = dakika(baslangic), let bit = dakika(bitis), bit > bas else { return 0 }
        return Double(bit - bas) / 60
    }

    static func dakika(_ value: String?) -> Int? {
        guard let value else { return nil }
        let parcalar = value.split(separator: ":")
        guard parcalar.count >= 2,
              let saat = Int(parcalar[0]),
              let dakika = Int(parcalar[1]) else { return nil }
        return saat * 60 + dakika
    }
}

private struct WorkLogCreateSheet: View {
    @ObservedObject var store: KBListStore<WorkLogDTO>
    let sekme: MesaiSekmesi
    let onClose: () -> Void

    @State private var personnel: [PersonnelDTO] = []
    @State private var vehicles: [VehicleDTO] = []
    @State private var personnelId = ""
    @State private var vehicleId = ""
    @State private var giris = "08:00"
    @State private var cikis = "17:00"
    @State private var secenekHatasi: String?

    var body: some View {
        KBFormSheet(
            title: sekme == .personel ? "Personel Mesaisi" : "Araç Mesaisi",
            subtitle: "Saatler 24 saat biçiminde girilir (örn. 08:00).",
            submitTitle: "Mesaiyi Kaydet",
            canSubmit: secimGecerli && saatlerGecerli,
            isSubmitting: store.isSubmitting,
            errorMessage: secenekHatasi ?? store.errorMessage,
            onSubmit: gonder,
            onCancel: onClose
        ) {
            switch sekme {
            case .personel:
                KBFormPicker(
                    title: "Personel",
                    required: true,
                    selection: $personnelId,
                    options: personnel.map { KBPickerOption(value: $0.id, label: $0.adSoyad ?? $0.id) }
                )
            case .arac:
                KBFormPicker(
                    title: "Araç",
                    required: true,
                    selection: $vehicleId,
                    options: vehicles.map { KBPickerOption(value: $0.id, label: $0.plaka ?? $0.id) }
                )
            }
            KBFormTextField(title: "Giriş saati", required: true, placeholder: "08:00", text: $giris)
            KBFormTextField(title: "Çıkış saati", required: true, placeholder: "17:00", text: $cikis)
        }
        // Yalnızca açık sekmenin listesi indirilir; ikisini birden çekmek boşunaydı.
        .task {
            switch sekme {
            case .personel:
                let sonuc = await KBOptionLoad.personel()
                personnel = sonuc.liste
                secenekHatasi = sonuc.hata
                if personnelId.isEmpty { personnelId = personnel.first?.id ?? "" }
            case .arac:
                let sonuc = await KBOptionLoad.araclar()
                vehicles = sonuc.liste
                secenekHatasi = sonuc.hata
                if vehicleId.isEmpty { vehicleId = vehicles.first?.id ?? "" }
            }
        }
    }

    private var secimGecerli: Bool {
        switch sekme {
        case .personel: return !personnelId.isEmpty
        case .arac: return !vehicleId.isEmpty
        }
    }

    private var saatlerGecerli: Bool {
        MesaiHesap.dakika(giris) != nil && MesaiHesap.dakika(cikis) != nil
    }

    private func gonder() {
        Task {
            var alanlar: [String: String] = [
                "tarih": ISO8601DateFormatter().string(from: Date()),
                "girisSaati": giris,
                "cikisSaati": cikis,
            ]
            switch sekme {
            case .personel: alanlar["personnelId"] = personnelId
            case .arac: alanlar["vehicleId"] = vehicleId
            }
            let kind = sekme == .personel ? "personel" : "arac"
            let ok = await store.mutate(success: "Mesai kaydedildi") {
                try await APIClient.shared.createWorkLog(kind: kind, fields: alanlar)
            }
            if ok { onClose() }
        }
    }
}
