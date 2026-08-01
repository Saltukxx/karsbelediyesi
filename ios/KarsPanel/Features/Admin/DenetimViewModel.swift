import Foundation

/// `KBPickerField` kimliğe göre seçim yapar; filtre açılır listeleri bu sarmalayıcıyı kullanır.
struct DenetimSecenek: Identifiable, Hashable {
    let id: String
}

@MainActor
final class DenetimViewModel: ObservableObject {
    @Published private(set) var kayitlar: [DenetimKaydiDTO] = []
    @Published private(set) var toplam = 0
    @Published private(set) var page = 1
    @Published private(set) var toplamSayfa = 1
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    @Published private(set) var kullaniciFiltresi = ""
    @Published private(set) var islemFiltresi: String?
    @Published private(set) var varlikFiltresi: String?
    @Published private(set) var baslangicFiltresi: Date?
    @Published private(set) var bitisFiltresi: Date?

    @Published private(set) var islemSecenekleri: [DenetimSecenek] = []
    @Published private(set) var varlikSecenekleri: [DenetimSecenek] = []

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var filtreliMi: Bool {
        !kullaniciFiltresi.isEmpty || islemFiltresi != nil || varlikFiltresi != nil
            || baslangicFiltresi != nil || bitisFiltresi != nil
    }

    var filtreOzeti: String {
        var parcalar: [String] = []
        if !kullaniciFiltresi.isEmpty { parcalar.append(kullaniciFiltresi) }
        if let islemFiltresi { parcalar.append(DenetimIslemi.etiket(islemFiltresi)) }
        if let varlikFiltresi { parcalar.append(varlikFiltresi) }
        if let baslangicFiltresi {
            parcalar.append("≥ \(baslangicFiltresi.formatted(date: .numeric, time: .omitted))")
        }
        if let bitisFiltresi {
            parcalar.append("≤ \(bitisFiltresi.formatted(date: .numeric, time: .omitted))")
        }
        return parcalar.joined(separator: " · ")
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let sonuc = try await api.fetchDenetim(
                kullanici: kullaniciFiltresi.isEmpty ? nil : kullaniciFiltresi,
                islem: islemFiltresi,
                varlik: varlikFiltresi,
                baslangic: baslangicFiltresi,
                bitis: bitisFiltresi,
                page: page
            )
            kayitlar = sonuc.kayitlar
            toplam = sonuc.toplam
            toplamSayfa = sonuc.toplamSayfa
            // Facet listeleri filtreden bağımsız gelir; her yüklemede tazelenir
            islemSecenekleri = sonuc.islemler.map(DenetimSecenek.init)
            varlikSecenekleri = sonuc.varliklar.map(DenetimSecenek.init)
            // Filtre daraldığında son sayfa kaybolabilir; başa dönülür
            if page > sonuc.toplamSayfa {
                page = 1
                await load()
            }
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    func filtreUygula(
        kullanici: String,
        islem: String?,
        varlik: String?,
        baslangic: Date?,
        bitis: Date?
    ) async {
        kullaniciFiltresi = kullanici.trimmingCharacters(in: .whitespaces)
        islemFiltresi = islem
        varlikFiltresi = varlik
        baslangicFiltresi = baslangic
        bitisFiltresi = bitis
        page = 1
        await load()
    }

    func filtreleriTemizle() async {
        kullaniciFiltresi = ""
        islemFiltresi = nil
        varlikFiltresi = nil
        baslangicFiltresi = nil
        bitisFiltresi = nil
        page = 1
        await load()
    }

    func oncekiSayfa() async {
        guard page > 1 else { return }
        page -= 1
        await load()
    }

    func sonrakiSayfa() async {
        guard page < toplamSayfa else { return }
        page += 1
        await load()
    }
}
