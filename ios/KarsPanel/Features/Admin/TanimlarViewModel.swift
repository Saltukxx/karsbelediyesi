import Foundation

/// `/tanimlar` — yönetim tanımları ve panel kullanıcıları.
///
/// Web sayfası her kaydetmede tüm listeyi yeniden getirir; burada da aynı
/// yaklaşım izlenir çünkü bir kaydın değişmesi başka listelerin görünümünü de
/// etkileyebilir (örn. pasife çekilen müdürlük şikayet türü satırlarında görünür).
@MainActor
final class TanimlarViewModel: ObservableObject {
    @Published private(set) var veri: TanimlarDTO?
    @Published private(set) var isLoading = false
    @Published private(set) var islemYapiliyor = false
    @Published var errorMessage: String?
    @Published var bilgiMesaji: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var mahalleler: [TanimOgesiDTO] { veri?.mahalleler ?? [] }
    var mudurlukler: [MudurlukTanimDTO] { veri?.mudurlukler ?? [] }
    var sikayetTurleri: [SikayetTuruTanimDTO] { veri?.sikayetTurleri ?? [] }
    var aracCinsleri: [TanimOgesiDTO] { veri?.aracCinsleri ?? [] }
    var kullanicilar: [PanelKullaniciDTO] { veri?.kullanicilar ?? [] }
    var otomatikAtama: Bool { veri?.otomatikAtama ?? false }

    func mudurlukAdi(_ id: String?) -> String? {
        guard let id else { return nil }
        guard let m = mudurlukler.first(where: { $0.id == id }) else { return nil }
        return m.shortName.isEmpty ? m.name : m.shortName
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            veri = try await api.fetchTanimlar()
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    /// Yazma işlemlerinin ortak sarmalayıcısı: kilit, hata mesajı ve başarıdan
    /// sonra listenin yenilenmesi.
    private func islem(_ basariMesaji: String, _ eylem: () async throws -> Void) async -> Bool {
        islemYapiliyor = true
        errorMessage = nil
        bilgiMesaji = nil
        defer { islemYapiliyor = false }
        do {
            try await eylem()
            veri = try await api.fetchTanimlar()
            bilgiMesaji = basariMesaji
            return true
        } catch {
            errorMessage = APIError.describe(error)
            return false
        }
    }

    @discardableResult
    func mahalleEkle(_ ad: String) async -> Bool {
        await islem("Mahalle eklendi") { _ = try await api.createMahalle(name: ad) }
    }

    @discardableResult
    func aracCinsiEkle(_ ad: String) async -> Bool {
        await islem("Araç cinsi eklendi") { _ = try await api.createAracCinsi(name: ad) }
    }

    @discardableResult
    func mudurlukKaydet(id: String?, _ body: MudurlukRequestDTO) async -> Bool {
        await islem(id == nil ? "Müdürlük eklendi" : "Müdürlük güncellendi") {
            if let id {
                _ = try await api.updateMudurluk(id: id, body)
            } else {
                _ = try await api.createMudurluk(body)
            }
        }
    }

    @discardableResult
    func sikayetTuruKaydet(id: String?, _ body: SikayetTuruRequestDTO) async -> Bool {
        await islem(id == nil ? "Şikayet türü eklendi" : "Şikayet türü güncellendi") {
            if let id {
                _ = try await api.updateSikayetTuru(id: id, body)
            } else {
                _ = try await api.createSikayetTuru(body)
            }
        }
    }

    @discardableResult
    func kullaniciOlustur(_ body: KullaniciOlusturRequestDTO) async -> Bool {
        await islem("Kullanıcı oluşturuldu") { _ = try await api.createKullanici(body) }
    }

    @discardableResult
    func kullaniciGuncelle(id: String, _ body: KullaniciGuncelleRequestDTO) async -> Bool {
        await islem("Kullanıcı güncellendi") {
            _ = try await api.updateKullanici(id: id, body)
        }
    }

    @discardableResult
    func otomatikAtamaKaydet(_ acik: Bool) async -> Bool {
        await islem(acik ? "Otomatik atama açıldı" : "Otomatik atama kapatıldı") {
            try await api.setOtomatikAtama(acik)
        }
    }
}
