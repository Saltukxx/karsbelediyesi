import Foundation

/// `packages/shared/src/calculations.ts` içindeki Excel formüllerinin Swift portu.
/// Kaydı sunucu yine kendi hesaplar; buradaki değerler form önizlemesidir ve
/// `KarsPanelTests` içinde web testleriyle aynı beklenen değerlere karşı doğrulanır.
enum WorkHourMath {
    /// `HH:mm` → gün kesri (08:00 → 1/3). Biçim bozuksa `nil`.
    static func saatKesri(_ text: String) -> Double? {
        let parts = text.split(separator: ":")
        guard parts.count == 2,
              parts[0].count == 2,
              parts[1].count == 2,
              let saat = Int(parts[0]),
              let dakika = Int(parts[1]),
              (0...23).contains(saat),
              (0...59).contains(dakika)
        else { return nil }
        return (Double(saat) * 60 + Double(dakika)) / (24 * 60)
    }

    static func isValidTime(_ text: String) -> Bool {
        saatKesri(text) != nil
    }

    /// Excel H: 08:00–17:00 aralığı, 12:00–13:00 öğle molası düşülür.
    static func normalSaat(giris: String, cikis: String) -> Double? {
        guard let g = saatKesri(giris), let c = saatKesri(cikis) else { return nil }
        let calisilan = max(0, (min(17.0 / 24, c) - max(8.0 / 24, g)) * 24)
        let mola = max(0, (min(13.0 / 24, c) - max(12.0 / 24, g)) * 24)
        return max(0, calisilan - mola)
    }

    /// Excel I: 17:00 sonrası fazla mesai.
    static func mesaiSaat(cikis: String) -> Double? {
        guard let c = saatKesri(cikis) else { return nil }
        return max(0, (c - 17.0 / 24) * 24)
    }

    /// Excel J = H + I.
    static func toplamSaat(giris: String, cikis: String) -> Double? {
        guard let normal = normalSaat(giris: giris, cikis: cikis),
              let mesai = mesaiSaat(cikis: cikis) else { return nil }
        return normal + mesai
    }

    /// Araç çalışma saati; gece devrini destekler (Excel: IF(çıkış>giriş,…)).
    static func aracCalismaSaati(giris: String, cikis: String) -> Double? {
        guard let g = saatKesri(giris), let c = saatKesri(cikis) else { return nil }
        return c > g ? (c - g) * 24 : (1 + c - g) * 24
    }
}
