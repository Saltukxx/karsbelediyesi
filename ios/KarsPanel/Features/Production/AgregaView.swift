import SwiftUI

/// `/agrega` — maliyet parametreleri, fiziksel aşama maliyeti ve proje modeli.
/// Parametre değiştikçe hesap yerel olarak yeniden çalışır (web'in canlı
/// hesaplayıcısının karşılığı); kaydet basıldığında sunucu doğrulayıp döner.
struct AgregaCostView: View {
    private enum Tab: String, CaseIterable, Identifiable {
        case parametre
        case fiziksel
        case proje

        var id: String { rawValue }
        var label: String {
            switch self {
            case .parametre: return "Parametreler"
            case .fiziksel: return "Aşama Maliyeti"
            case .proje: return "Proje Modeli"
            }
        }
    }

    @StateObject private var viewModel = AgregaViewModel()
    @EnvironmentObject private var session: AppSession
    @State private var tab: Tab = .fiziksel

    var body: some View {
        KBModuleScreen(
            title: NavDestination.agrega.label,
            icon: NavDestination.agrega.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: !viewModel.hasData,
            emptyMessage: "Agrega parametreleri henüz tanımlanmamış.",
            onRefresh: { await viewModel.load() }
        ) {
            Section {
                Picker("Sekme", selection: $tab) {
                    ForEach(Tab.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                .listRowBackground(Color.clear)
            }

            Section {
                KBStatRow(tiles: viewModel.ozet)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    .listRowBackground(Color.clear)
            }

            switch tab {
            case .parametre: parametreIcerigi
            case .fiziksel: fizikselIcerigi
            case .proje: projeIcerigi
            }
        }
        .task { if !viewModel.hasData { await viewModel.load() } }
    }

    // MARK: Parametre girişi

    @ViewBuilder
    private var parametreIcerigi: some View {
        Section("Genel") {
            KBNumberField(title: "Mesafe", text: $viewModel.mesafeKm, suffix: "km")
            KBNumberField(title: "Motorin fiyatı", text: $viewModel.motorinFiyat, suffix: "₺/lt")
            KBNumberField(
                title: "Elektrik fiyatı",
                text: $viewModel.elektrikFiyat,
                suffix: "₺/kWh"
            )
            KBNumberField(
                title: "Dönem üretimi",
                text: $viewModel.donemUretimTon,
                suffix: "ton"
            )
        }

        Section("Aşama 1 — Söküm") {
            KBNumberField(title: "Yakıt", text: $viewModel.sokumYakitLtSaat, suffix: "lt/saat")
            KBNumberField(title: "Amortisman", text: $viewModel.sokumAmortisman, suffix: "₺/saat")
            KBNumberField(
                title: "Kapasite",
                text: $viewModel.sokumKapasiteTonSaat,
                suffix: "ton/saat"
            )
        }

        Section("Aşama 2 — Yükleme") {
            KBNumberField(title: "Yakıt", text: $viewModel.yuklemeYakitLtSaat, suffix: "lt/saat")
            KBNumberField(
                title: "Amortisman",
                text: $viewModel.yuklemeAmortisman,
                suffix: "₺/saat"
            )
            KBNumberField(
                title: "Kapasite",
                text: $viewModel.yuklemeKapasiteTonSaat,
                suffix: "ton/saat"
            )
        }

        Section("Aşama 3 — Nakliye") {
            KBNumberField(
                title: "Kamyon kapasitesi",
                text: $viewModel.kamyonKapasiteTon,
                suffix: "ton"
            )
            KBNumberField(title: "Kamyon yakıtı", text: $viewModel.kamyonYakitLtKm, suffix: "lt/km")
            KBNumberField(title: "Sefer hızı", text: $viewModel.seferHizKmSaat, suffix: "km/saat")
            KBNumberField(
                title: "Yükleme/boşaltma",
                text: $viewModel.yuklemeBosaltmaDk,
                suffix: "dk"
            )
            KBNumberField(
                title: "Kamyon amortismanı",
                text: $viewModel.kamyonAmortisman,
                suffix: "₺/saat"
            )
        }

        Section("Aşama 4 — Kırıcı") {
            KBNumberField(title: "Kırıcı gücü", text: $viewModel.kiriciKw, suffix: "kW")
            KBNumberField(title: "Yük faktörü", text: $viewModel.yukFaktoru)
            KBNumberField(
                title: "Kapasite",
                text: $viewModel.kiriciKapasiteTonSaat,
                suffix: "ton/saat"
            )
        }

        Section("Boyut oranları") {
            KBNumberField(title: "0–5 mm oranı", text: $viewModel.oran05)
            KBNumberField(title: "5–12 mm oranı", text: $viewModel.oran512)
            KBNumberField(title: "12–19 mm oranı", text: $viewModel.oran1219)
            KBNumberField(title: "19–32 mm oranı", text: $viewModel.oran1932)
            KBDetailRow(label: "Oran toplamı", value: viewModel.oranToplamiMetni)
        }

        Section("Proje kalemleri (₺/ton)") {
            KBNumberField(title: "Günlük hedef", text: $viewModel.gunlukHedefTon, suffix: "ton")
            KBNumberField(
                title: "Yıllık çalışma günü",
                text: $viewModel.yillikCalismaGun,
                decimals: false
            )
            KBNumberField(title: "Kırıcı yakıt", text: $viewModel.kiriciYakitTon)
            KBNumberField(title: "Kırıcı bakım", text: $viewModel.kiriciBakimTon)
            KBNumberField(title: "Yükleyici yakıt", text: $viewModel.yukleyiciYakitTon)
            KBNumberField(title: "Yükleyici bakım", text: $viewModel.yukleyiciBakimTon)
            KBNumberField(title: "Nakliye yakıt", text: $viewModel.nakliyeYakitTon)
            KBNumberField(title: "Elek elektrik", text: $viewModel.elekElektrikTon)
            KBNumberField(title: "Eleme bakım", text: $viewModel.elemeBakimTon)
            KBNumberField(title: "Yıkama suyu", text: $viewModel.yikamaSuTon)
            KBNumberField(title: "Genel gider", text: $viewModel.genelGiderTon)
        }

        Section("Satış ve stok hedefleri") {
            ForEach($viewModel.boyutlar) { $boyut in
                KBNumberField(
                    title: "\(boyut.boyut) satış fiyatı",
                    text: $boyut.satisFiyati,
                    suffix: "₺/ton"
                )
                KBNumberField(
                    title: "\(boyut.boyut) stok hedefi",
                    text: $boyut.stokHedefi,
                    suffix: "ton"
                )
            }
        }

        if session.canManageOperations {
            Section {
                KBFormActions(
                    saveTitle: "Parametreleri Kaydet",
                    isSaving: viewModel.isSaving,
                    isEnabled: viewModel.isValid,
                    errorMessage: viewModel.saveError
                ) {
                    Task { await viewModel.save() }
                }
            } footer: {
                Text("Hesaplar anında güncellenir; kaydetmeden sunucuya yazılmaz.")
            }
        }
    }

    // MARK: Fiziksel aşama maliyeti

    @ViewBuilder
    private var fizikselIcerigi: some View {
        let sonuc = viewModel.fiziksel

        Section("Aşama birim maliyetleri (₺/ton)") {
            asamaSatiri("1 — Söküm", sonuc.asama1, sonuc.toplamBirim)
            asamaSatiri("2 — Yükleme", sonuc.asama2, sonuc.toplamBirim)
            asamaSatiri("3 — Nakliye", sonuc.asama3, sonuc.toplamBirim)
            asamaSatiri("4 — Kırıcı elektrik", sonuc.asama4, sonuc.toplamBirim)
            KBDetailRow(
                label: "TOPLAM",
                value: KBNumberFormat.para(sonuc.toplamBirim) + "/ton"
            )
        }

        Section("Nakliye ara değerleri") {
            KBDetailRow(
                label: "Sefer mesafesi",
                value: KBNumberFormat.miktar(sonuc.seferMesafe, birim: "km")
            )
            KBDetailRow(label: "Sefer yakıtı", value: KBNumberFormat.para(sonuc.seferYakit))
            KBDetailRow(
                label: "Sefer süresi",
                value: KBNumberFormat.miktar(sonuc.seferSure, birim: "saat")
            )
            KBDetailRow(label: "Sefer toplamı", value: KBNumberFormat.para(sonuc.seferToplam))
        }

        Section("Boyut bazlı dönem maliyeti") {
            ForEach(sonuc.boyutlar) { boyut in
                KBListRow(
                    title: boyut.boyut,
                    subtitle: "Oran \(yuzde(boyut.oran))",
                    detail: "Tonaj \(KBNumberFormat.miktar(boyut.tonaj, birim: "ton"))"
                        + " · Birim \(KBNumberFormat.para(boyut.birimMaliyet))",
                    trailingValue: KBNumberFormat.para(boyut.toplamMaliyet)
                )
            }
            KBDetailRow(
                label: "Dönem toplam maliyeti",
                value: KBNumberFormat.para(sonuc.donemToplamMaliyet)
            )
        }
    }

    // MARK: Proje modeli

    @ViewBuilder
    private var projeIcerigi: some View {
        let sonuc = viewModel.proje

        Section("Kalem toplamları (₺/ton)") {
            KBDetailRow(label: "Maden", value: KBNumberFormat.para(sonuc.maden))
            KBDetailRow(label: "Nakliye", value: KBNumberFormat.para(sonuc.nakliye))
            KBDetailRow(label: "Eleme", value: KBNumberFormat.para(sonuc.eleme))
            KBDetailRow(label: "Genel gider", value: KBNumberFormat.para(sonuc.genel))
            KBDetailRow(label: "BİRİM MALİYET", value: KBNumberFormat.para(sonuc.birim))
        }

        Section("Projeksiyon") {
            KBDetailRow(label: "Günlük maliyet", value: KBNumberFormat.para(sonuc.gunluk))
            KBDetailRow(label: "Aylık maliyet", value: KBNumberFormat.para(viewModel.aylikMaliyet))
            KBDetailRow(
                label: "Yıllık maliyet",
                value: KBNumberFormat.para(viewModel.yillikMaliyet)
            )
            KBDetailRow(
                label: "Yıllık üretim",
                value: KBNumberFormat.miktar(viewModel.yillikUretim, birim: "ton")
            )
            KBDetailRow(
                label: "Ağırlıklı satış",
                value: KBNumberFormat.para(sonuc.agirlikliSatis)
            )
            KBDetailRow(
                label: "Ağırlıklı kâr",
                value: KBNumberFormat.para(sonuc.agirlikliKar)
            )
        }

        Section("Boyut bazlı kâr") {
            ForEach(sonuc.boyutDetay) { boyut in
                KBListRow(
                    title: boyut.boyut,
                    subtitle: "Satış \(KBNumberFormat.para(boyut.satisFiyati))"
                        + " · Brüt kâr \(KBNumberFormat.para(boyut.brutKarTon))/ton",
                    detail: "Günlük \(KBNumberFormat.miktar(boyut.gunlukTon, birim: "ton"))"
                        + " · Stok hedefi \(KBNumberFormat.miktar(boyut.stokHedefi, birim: "ton"))"
                        + " · Stok payı \(yuzde(AgregaMath.stokPayi(stokHedefi: boyut.stokHedefi, toplamStokHedefi: sonuc.toplamStokHedefi)))",
                    badge: boyut.brutKarTon >= 0 ? "Kârlı" : "Zararlı",
                    badgeTone: boyut.brutKarTon >= 0 ? .success : .danger,
                    trailingValue: KBNumberFormat.para(boyut.potansiyelKar)
                )
            }
        }

        Section("Stok toplamları") {
            KBDetailRow(
                label: "Toplam stok hedefi",
                value: KBNumberFormat.miktar(sonuc.toplamStokHedefi, birim: "ton")
            )
            KBDetailRow(
                label: "Stok maliyeti",
                value: KBNumberFormat.para(sonuc.toplamStokMaliyeti)
            )
            KBDetailRow(label: "Stok değeri", value: KBNumberFormat.para(sonuc.toplamStokDegeri))
            KBDetailRow(
                label: "Potansiyel kâr",
                value: KBNumberFormat.para(sonuc.potansiyelKar)
            )
        }
    }

    private func asamaSatiri(_ label: String, _ deger: Double, _ toplam: Double) -> some View {
        KBDetailRow(
            label: label,
            value: KBNumberFormat.para(deger)
                + " (\(yuzde(AgregaMath.asamaPayi(asamaBirim: deger, toplamBirim: toplam))))"
        )
    }

    private func yuzde(_ oran: Double) -> String {
        String(format: "%.1f%%", oran * 100)
    }
}

@MainActor
final class AgregaViewModel: ObservableObject {
    struct BoyutAlanlari: Identifiable {
        let boyut: String
        var oran: Double
        var satisFiyati: String
        var stokHedefi: String
        var id: String { boyut }
    }

    // Parametre alanları metin olarak tutulur (Türkçe ondalık ayırıcı desteği)
    @Published var mesafeKm = ""
    @Published var motorinFiyat = ""
    @Published var elektrikFiyat = ""
    @Published var sokumYakitLtSaat = ""
    @Published var sokumAmortisman = ""
    @Published var sokumKapasiteTonSaat = ""
    @Published var yuklemeYakitLtSaat = ""
    @Published var yuklemeAmortisman = ""
    @Published var yuklemeKapasiteTonSaat = ""
    @Published var kamyonKapasiteTon = ""
    @Published var kamyonYakitLtKm = ""
    @Published var seferHizKmSaat = ""
    @Published var yuklemeBosaltmaDk = ""
    @Published var kamyonAmortisman = ""
    @Published var kiriciKw = ""
    @Published var yukFaktoru = ""
    @Published var kiriciKapasiteTonSaat = ""
    @Published var oran05 = ""
    @Published var oran512 = ""
    @Published var oran1219 = ""
    @Published var oran1932 = ""
    @Published var donemUretimTon = ""
    @Published var gunlukHedefTon = ""
    @Published var yillikCalismaGun = ""
    @Published var kiriciYakitTon = ""
    @Published var kiriciBakimTon = ""
    @Published var yukleyiciYakitTon = ""
    @Published var yukleyiciBakimTon = ""
    @Published var nakliyeYakitTon = ""
    @Published var elekElektrikTon = ""
    @Published var elemeBakimTon = ""
    @Published var yikamaSuTon = ""
    @Published var genelGiderTon = ""
    @Published var boyutlar: [BoyutAlanlari] = []

    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published private(set) var hasData = false
    @Published var errorMessage: String?
    @Published var saveError: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    private func sayi(_ text: String) -> Double { KBNumberFormat.parse(text) ?? 0 }

    var fizikselGirdi: AgregaMath.FizikselParams {
        AgregaMath.FizikselParams(
            mesafeKm: sayi(mesafeKm),
            motorinFiyat: sayi(motorinFiyat),
            elektrikFiyat: sayi(elektrikFiyat),
            sokumYakitLtSaat: sayi(sokumYakitLtSaat),
            sokumAmortisman: sayi(sokumAmortisman),
            sokumKapasiteTonSaat: sayi(sokumKapasiteTonSaat),
            yuklemeYakitLtSaat: sayi(yuklemeYakitLtSaat),
            yuklemeAmortisman: sayi(yuklemeAmortisman),
            yuklemeKapasiteTonSaat: sayi(yuklemeKapasiteTonSaat),
            kamyonKapasiteTon: sayi(kamyonKapasiteTon),
            kamyonYakitLtKm: sayi(kamyonYakitLtKm),
            seferHizKmSaat: sayi(seferHizKmSaat),
            yuklemeBosaltmaDk: sayi(yuklemeBosaltmaDk),
            kamyonAmortisman: sayi(kamyonAmortisman),
            kiriciKw: sayi(kiriciKw),
            yukFaktoru: sayi(yukFaktoru),
            kiriciKapasiteTonSaat: sayi(kiriciKapasiteTonSaat),
            oran05: sayi(oran05),
            oran512: sayi(oran512),
            oran1219: sayi(oran1219),
            oran1932: sayi(oran1932),
            donemUretimTon: sayi(donemUretimTon)
        )
    }

    var projeGirdi: AgregaMath.ProjeParams {
        AgregaMath.ProjeParams(
            gunlukHedefTon: sayi(gunlukHedefTon),
            kiriciYakitTon: sayi(kiriciYakitTon),
            kiriciBakimTon: sayi(kiriciBakimTon),
            yukleyiciYakitTon: sayi(yukleyiciYakitTon),
            yukleyiciBakimTon: sayi(yukleyiciBakimTon),
            nakliyeYakitTon: sayi(nakliyeYakitTon),
            elekElektrikTon: sayi(elekElektrikTon),
            elemeBakimTon: sayi(elemeBakimTon),
            yikamaSuTon: sayi(yikamaSuTon),
            genelGiderTon: sayi(genelGiderTon),
            boyutlar: boyutlar.map {
                AgregaMath.BoyutSatis(
                    boyut: $0.boyut,
                    // Sunucu oranı her zaman oranXX kolonlarından türetir; canlı
                    // hesap da aynı kaynağı kullanmalı ki kaydetmeden önce/sonra
                    // aynı sonuç çıksın.
                    oran: canliOran($0.boyut) ?? $0.oran,
                    satisFiyati: sayi($0.satisFiyati),
                    stokHedefi: sayi($0.stokHedefi)
                )
            }
        )
    }

    private func canliOran(_ boyut: String) -> Double? {
        switch boyut {
        case "0-5 mm": return KBNumberFormat.parse(oran05)
        case "5-12 mm": return KBNumberFormat.parse(oran512)
        case "12-19 mm": return KBNumberFormat.parse(oran1219)
        case "19-32 mm": return KBNumberFormat.parse(oran1932)
        default: return nil
        }
    }

    var fiziksel: AgregaMath.FizikselSonuc { AgregaMath.fizikselMaliyet(fizikselGirdi) }
    var proje: AgregaMath.ProjeSonuc { AgregaMath.projeMaliyet(projeGirdi) }

    var yillikUretim: Double {
        AgregaMath.yillikUretim(
            gunlukHedefTon: sayi(gunlukHedefTon),
            yillikCalismaGun: sayi(yillikCalismaGun)
        )
    }

    var aylikMaliyet: Double {
        AgregaMath.aylikMaliyet(
            gunlukMaliyet: proje.gunluk,
            yillikCalismaGun: sayi(yillikCalismaGun)
        )
    }

    var yillikMaliyet: Double {
        AgregaMath.yillikMaliyet(
            gunlukMaliyet: proje.gunluk,
            yillikCalismaGun: sayi(yillikCalismaGun)
        )
    }

    var oranToplamiMetni: String {
        let toplam = sayi(oran05) + sayi(oran512) + sayi(oran1219) + sayi(oran1932)
        return String(format: "%.3f", toplam)
    }

    var ozet: [KBStat] {
        [
            KBStat(
                label: "Fiziksel birim",
                value: KBNumberFormat.para(fiziksel.toplamBirim),
                tone: .accent
            ),
            KBStat(label: "Proje birim", value: KBNumberFormat.para(proje.birim)),
            KBStat(
                label: "Ağırlıklı kâr",
                value: KBNumberFormat.para(proje.agirlikliKar),
                tone: proje.agirlikliKar >= 0 ? .success : .danger
            ),
            KBStat(
                label: "Potansiyel kâr",
                value: KBNumberFormat.para(proje.potansiyelKar),
                tone: proje.potansiyelKar >= 0 ? .success : .danger
            ),
        ]
    }

    var isValid: Bool {
        !metinAlanlari.contains { KBNumberFormat.isInvalid($0) }
            && !boyutlar.contains {
                KBNumberFormat.isInvalid($0.satisFiyati)
                    || KBNumberFormat.isInvalid($0.stokHedefi)
            }
    }

    private var metinAlanlari: [String] {
        [
            mesafeKm, motorinFiyat, elektrikFiyat, sokumYakitLtSaat, sokumAmortisman,
            sokumKapasiteTonSaat, yuklemeYakitLtSaat, yuklemeAmortisman,
            yuklemeKapasiteTonSaat, kamyonKapasiteTon, kamyonYakitLtKm, seferHizKmSaat,
            yuklemeBosaltmaDk, kamyonAmortisman, kiriciKw, yukFaktoru,
            kiriciKapasiteTonSaat, oran05, oran512, oran1219, oran1932, donemUretimTon,
            gunlukHedefTon, yillikCalismaGun, kiriciYakitTon, kiriciBakimTon,
            yukleyiciYakitTon, yukleyiciBakimTon, nakliyeYakitTon, elekElektrikTon,
            elemeBakimTon, yikamaSuTon, genelGiderTon,
        ]
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            apply(try await api.fetchAgregaOverview())
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func save() async {
        isSaving = true
        saveError = nil
        do {
            let response = try await api.saveAgregaParams(istek)
            apply(response)
        } catch {
            saveError = APIError.describe(error)
        }
        isSaving = false
    }

    private var istek: AgregaParamsRequestDTO {
        func satis(_ boyut: String) -> Double? {
            boyutlar.first { $0.boyut == boyut }.flatMap { KBNumberFormat.parse($0.satisFiyati) }
        }
        func stok(_ boyut: String) -> Double? {
            boyutlar.first { $0.boyut == boyut }.flatMap { KBNumberFormat.parse($0.stokHedefi) }
        }

        return AgregaParamsRequestDTO(
            mesafeKm: KBNumberFormat.parse(mesafeKm),
            motorinFiyat: KBNumberFormat.parse(motorinFiyat),
            elektrikFiyat: KBNumberFormat.parse(elektrikFiyat),
            sokumYakitLtSaat: KBNumberFormat.parse(sokumYakitLtSaat),
            sokumAmortisman: KBNumberFormat.parse(sokumAmortisman),
            sokumKapasiteTonSaat: KBNumberFormat.parse(sokumKapasiteTonSaat),
            yuklemeYakitLtSaat: KBNumberFormat.parse(yuklemeYakitLtSaat),
            yuklemeAmortisman: KBNumberFormat.parse(yuklemeAmortisman),
            yuklemeKapasiteTonSaat: KBNumberFormat.parse(yuklemeKapasiteTonSaat),
            kamyonKapasiteTon: KBNumberFormat.parse(kamyonKapasiteTon),
            kamyonYakitLtKm: KBNumberFormat.parse(kamyonYakitLtKm),
            seferHizKmSaat: KBNumberFormat.parse(seferHizKmSaat),
            yuklemeBosaltmaDk: KBNumberFormat.parse(yuklemeBosaltmaDk),
            kamyonAmortisman: KBNumberFormat.parse(kamyonAmortisman),
            kiriciKw: KBNumberFormat.parse(kiriciKw),
            yukFaktoru: KBNumberFormat.parse(yukFaktoru),
            kiriciKapasiteTonSaat: KBNumberFormat.parse(kiriciKapasiteTonSaat),
            oran05: KBNumberFormat.parse(oran05),
            oran512: KBNumberFormat.parse(oran512),
            oran1219: KBNumberFormat.parse(oran1219),
            oran1932: KBNumberFormat.parse(oran1932),
            donemUretimTon: KBNumberFormat.parse(donemUretimTon),
            gunlukHedefTon: KBNumberFormat.parse(gunlukHedefTon),
            yillikCalismaGun: KBNumberFormat.parse(yillikCalismaGun),
            kiriciYakitTon: KBNumberFormat.parse(kiriciYakitTon),
            kiriciBakimTon: KBNumberFormat.parse(kiriciBakimTon),
            yukleyiciYakitTon: KBNumberFormat.parse(yukleyiciYakitTon),
            yukleyiciBakimTon: KBNumberFormat.parse(yukleyiciBakimTon),
            nakliyeYakitTon: KBNumberFormat.parse(nakliyeYakitTon),
            elekElektrikTon: KBNumberFormat.parse(elekElektrikTon),
            elemeBakimTon: KBNumberFormat.parse(elemeBakimTon),
            yikamaSuTon: KBNumberFormat.parse(yikamaSuTon),
            genelGiderTon: KBNumberFormat.parse(genelGiderTon),
            satis05: satis("0-5 mm"),
            satis512: satis("5-12 mm"),
            satis1219: satis("12-19 mm"),
            satis1932: satis("19-32 mm"),
            stok05: stok("0-5 mm"),
            stok512: stok("5-12 mm"),
            stok1219: stok("12-19 mm"),
            stok1932: stok("19-32 mm")
        )
    }

    private func apply(_ response: AgregaResponseDTO) {
        guard let p = response.parametreler else {
            hasData = false
            return
        }
        hasData = true
        mesafeKm = KBNumberFormat.text(p.mesafeKm)
        motorinFiyat = KBNumberFormat.text(p.motorinFiyat)
        elektrikFiyat = KBNumberFormat.text(p.elektrikFiyat)
        sokumYakitLtSaat = KBNumberFormat.text(p.sokumYakitLtSaat)
        sokumAmortisman = KBNumberFormat.text(p.sokumAmortisman)
        sokumKapasiteTonSaat = KBNumberFormat.text(p.sokumKapasiteTonSaat)
        yuklemeYakitLtSaat = KBNumberFormat.text(p.yuklemeYakitLtSaat)
        yuklemeAmortisman = KBNumberFormat.text(p.yuklemeAmortisman)
        yuklemeKapasiteTonSaat = KBNumberFormat.text(p.yuklemeKapasiteTonSaat)
        kamyonKapasiteTon = KBNumberFormat.text(p.kamyonKapasiteTon)
        kamyonYakitLtKm = KBNumberFormat.text(p.kamyonYakitLtKm)
        seferHizKmSaat = KBNumberFormat.text(p.seferHizKmSaat)
        yuklemeBosaltmaDk = KBNumberFormat.text(p.yuklemeBosaltmaDk)
        kamyonAmortisman = KBNumberFormat.text(p.kamyonAmortisman)
        kiriciKw = KBNumberFormat.text(p.kiriciKw)
        yukFaktoru = KBNumberFormat.text(p.yukFaktoru)
        kiriciKapasiteTonSaat = KBNumberFormat.text(p.kiriciKapasiteTonSaat)
        oran05 = KBNumberFormat.text(p.oran05)
        oran512 = KBNumberFormat.text(p.oran512)
        oran1219 = KBNumberFormat.text(p.oran1219)
        oran1932 = KBNumberFormat.text(p.oran1932)
        donemUretimTon = KBNumberFormat.text(p.donemUretimTon)
        gunlukHedefTon = KBNumberFormat.text(p.gunlukHedefTon)
        yillikCalismaGun = KBNumberFormat.text(p.yillikCalismaGun)
        kiriciYakitTon = KBNumberFormat.text(p.kiriciYakitTon)
        kiriciBakimTon = KBNumberFormat.text(p.kiriciBakimTon)
        yukleyiciYakitTon = KBNumberFormat.text(p.yukleyiciYakitTon)
        yukleyiciBakimTon = KBNumberFormat.text(p.yukleyiciBakimTon)
        nakliyeYakitTon = KBNumberFormat.text(p.nakliyeYakitTon)
        elekElektrikTon = KBNumberFormat.text(p.elekElektrikTon)
        elemeBakimTon = KBNumberFormat.text(p.elemeBakimTon)
        yikamaSuTon = KBNumberFormat.text(p.yikamaSuTon)
        genelGiderTon = KBNumberFormat.text(p.genelGiderTon)
        boyutlar = response.boyutSatis.map {
            BoyutAlanlari(
                boyut: $0.boyut,
                oran: $0.oran,
                satisFiyati: KBNumberFormat.text($0.satisFiyati),
                stokHedefi: KBNumberFormat.text($0.stokHedefi)
            )
        }
    }
}
