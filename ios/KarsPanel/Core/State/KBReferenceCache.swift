import Foundation

/// Form seçicilerinin beslendiği referans listeleri (araç, personel, tanım kümesi).
///
/// Aynı liste bakım, yakıt, mesai, görev ve kontrol formlarından ayrı ayrı indiriliyordu;
/// her form açılışı yeni bir tam liste isteği demekti. Burada kısa ömürlü bir kopya
/// tutulur, süre dolunca yeniden çekilir.
@MainActor
final class KBReferenceCache {
    static let shared = KBReferenceCache()

    /// Envanter gün içinde nadiren değişiyor; beş dakika hem tazelik hem sessizlik için yeterli.
    static let tazelikSuresi: TimeInterval = 300

    private var araclar: Kayit<[VehicleDTO]>?
    private var personeller: Kayit<[PersonnelDTO]>?
    private var lookuplar: Kayit<LookupsDTO>?

    private struct Kayit<T> {
        let deger: T
        let zaman: Date
    }

    func vehicles(force: Bool = false) async throws -> [VehicleDTO] {
        if !force, let taze = gecerli(araclar) { return taze }
        let deger = try await APIClient.shared.fetchVehicles()
        araclar = Kayit(deger: deger, zaman: Date())
        return deger
    }

    func personnel(force: Bool = false) async throws -> [PersonnelDTO] {
        if !force, let taze = gecerli(personeller) { return taze }
        let deger = try await APIClient.shared.fetchPersonnel()
        personeller = Kayit(deger: deger, zaman: Date())
        return deger
    }

    func lookups(force: Bool = false) async throws -> LookupsDTO {
        if !force, let taze = gecerli(lookuplar) { return taze }
        let deger = try await APIClient.shared.fetchLookups()
        lookuplar = Kayit(deger: deger, zaman: Date())
        return deger
    }

    /// Oturum değişiminde eski kullanıcının verisi kalmamalı.
    func temizle() {
        araclar = nil
        personeller = nil
        lookuplar = nil
    }

    private func gecerli<T>(_ kayit: Kayit<T>?) -> T? {
        guard let kayit, Date().timeIntervalSince(kayit.zaman) < Self.tazelikSuresi else { return nil }
        return kayit.deger
    }
}

/// Form seçicilerini beslerken hatayı yutmamak için. Önceden `try?` kullanılıyordu:
/// istek patladığında seçici boş kalıyor ama nedeni hiçbir yerde görünmüyordu.
@MainActor
enum KBOptionLoad {
    static func araclar() async -> (liste: [VehicleDTO], hata: String?) {
        await yukle("Araç listesi") { try await KBReferenceCache.shared.vehicles() }
    }

    static func personel() async -> (liste: [PersonnelDTO], hata: String?) {
        await yukle("Personel listesi") { try await KBReferenceCache.shared.personnel() }
    }

    private static func yukle<T>(
        _ ad: String,
        _ islem: () async throws -> [T]
    ) async -> (liste: [T], hata: String?) {
        do {
            return (try await islem(), nil)
        } catch is CancellationError {
            return ([], nil)
        } catch {
            return ([], "\(ad) yüklenemedi: \(KBErrorText.of(error))")
        }
    }
}
