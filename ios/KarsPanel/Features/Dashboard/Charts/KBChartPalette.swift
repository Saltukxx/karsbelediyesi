import SwiftUI

/// Grafiklerin ortak renk sözlüğü.
///
/// Anlamsal eşleme web panelindeki `components/charts/theme.ts` ile birebir
/// aynıdır (açık = info, devam = warning, kapatıldı = success ...); renk
/// değerleri ise mobilin Figma token'larından, yani `KBTheme`'den gelir. Böylece
/// iki platformda aynı veri aynı anlamı taşır ama mobil kendi tonunu korur.
enum KBChart {
    // Şikayet durumu
    static let acik = KBTheme.info
    static let devam = KBTheme.warning
    static let kapatildi = KBTheme.success

    // Trend serileri
    static let acilan = KBTheme.navy
    static let kapanan = KBTheme.success

    // SLA yaş kovaları
    static let slaHizli = KBTheme.success
    static let slaOrta = KBTheme.warning
    static let slaYavas = KBTheme.danger

    // Maliyet kalemleri
    static let bakim = KBTheme.navy
    static let yakit = KBTheme.accent

    // Mahalle / tekil seri
    static let tekil = KBTheme.navy

    /// Kategorik seriler için varsayılan sıra (web'deki `SERIES_COLORS`).
    static let seri: [Color] = [
        KBTheme.navy,
        KBTheme.accent,
        KBTheme.success,
        KBTheme.info,
        KBTheme.warning,
        KBTheme.danger,
        Color(red: 0x2a / 255, green: 0x4a / 255, blue: 0x73 / 255),
        KBTheme.muted,
    ]

    static func kategorik(_ index: Int) -> Color {
        seri[index % seri.count]
    }

    /// Araç operasyon durumu — panelde sabit renkler kullanılır.
    static func aracRengi(_ durumKey: String) -> Color {
        switch durumKey {
        case "MUSAIT": return KBTheme.success
        case "GOREVDE": return KBTheme.info
        case "BAKIMDA": return KBTheme.warning
        case "ARIZALI": return KBTheme.danger
        case "PLANLI_BAKIM": return KBTheme.muted
        default: return KBTheme.navy
        }
    }

    /// Kanal sayısı az ve sabit; renkler ada göre atanır ki dönemler arası kaymasın.
    static func kanalRengi(_ etiket: String) -> Color {
        switch etiket {
        case "Telefon": return KBTheme.navy
        case "WhatsApp": return KBTheme.success
        case "Web": return KBTheme.info
        default: return KBTheme.muted
        }
    }

    // MARK: - Isı haritası rampası

    private static let heatLow = (r: 0xee / 255.0, g: 0xf2 / 255.0, b: 0xf6 / 255.0)
    private static let heatMid = (r: 0xb9 / 255.0, g: 0xc8 / 255.0, b: 0xdd / 255.0)
    private static let heatHigh = (r: 0x00 / 255.0, g: 0x21 / 255.0, b: 0x47 / 255.0)

    /// 0...1 yoğunluğu web'deki `visualMap` rampasına eşler.
    static func isi(_ oran: Double) -> Color {
        let (r, g, b) = isiBilesenleri(oran)
        return Color(red: r, green: g, blue: b)
    }

    static func isiBilesenleri(_ oran: Double) -> (Double, Double, Double) {
        let t = min(max(oran, 0), 1)
        if t <= 0.5 {
            let k = t / 0.5
            return (
                heatLow.r + (heatMid.r - heatLow.r) * k,
                heatLow.g + (heatMid.g - heatLow.g) * k,
                heatLow.b + (heatMid.b - heatLow.b) * k
            )
        }
        let k = (t - 0.5) / 0.5
        return (
            heatMid.r + (heatHigh.r - heatMid.r) * k,
            heatMid.g + (heatHigh.g - heatMid.g) * k,
            heatMid.b + (heatHigh.b - heatMid.b) * k
        )
    }

    /// Alan grafiklerinde aşağı doğru şeffaflaşan dikey gradyan.
    static func alanGradyani(_ color: Color, tavan: Double = 0.22) -> LinearGradient {
        LinearGradient(
            colors: [color.opacity(tavan), color.opacity(0)],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

/// Grafik etiketlerinde kullanılan Türkçe biçimlendiriciler.
enum KBChartFormat {
    static let locale = Locale(identifier: "tr_TR")

    private static let sayi: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = locale
        f.maximumFractionDigits = 0
        return f
    }()

    private static let gunAnahtari: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Europe/Istanbul")
        return f
    }()

    private static let ayAnahtari: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Europe/Istanbul")
        return f
    }()

    private static let gunEtiketiBicimi: DateFormatter = {
        let f = DateFormatter()
        f.locale = locale
        f.timeZone = TimeZone(identifier: "Europe/Istanbul")
        f.setLocalizedDateFormatFromTemplate("d MMM")
        return f
    }()

    private static let ayEtiketiBicimi: DateFormatter = {
        let f = DateFormatter()
        f.locale = locale
        f.timeZone = TimeZone(identifier: "Europe/Istanbul")
        f.setLocalizedDateFormatFromTemplate("MMM yyyy")
        return f
    }()

    static func adet(_ value: Int) -> String {
        sayi.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    static func adet(_ value: Double) -> String {
        adet(Int(value.rounded()))
    }

    static func tl(_ value: Double) -> String {
        "\(adet(value.rounded())) ₺"
    }

    /// Eksen etiketi: 12.400 ₺ yerine "12b" — dar ekranda okunabilir kalsın.
    static func tlEksen(_ value: Double) -> String {
        if abs(value) >= 1_000_000 {
            return "\(adet((value / 1_000_000).rounded()))m"
        }
        if abs(value) >= 1000 {
            return "\(adet((value / 1000).rounded()))b"
        }
        return adet(value)
    }

    static func gunTarihi(_ key: String) -> Date? {
        gunAnahtari.date(from: key)
    }

    static func ayTarihi(_ key: String) -> Date? {
        ayAnahtari.date(from: key)
    }

    /// "2026-08-01" → "1 Ağu"
    static func gunEtiketi(_ key: String) -> String {
        guard let date = gunTarihi(key) else { return key }
        return gunEtiketiBicimi.string(from: date)
    }

    static func gunEtiketi(_ date: Date) -> String {
        gunEtiketiBicimi.string(from: date)
    }

    /// "2026-07" → "Tem 2026"
    static func ayEtiketi(_ key: String) -> String {
        guard let date = ayTarihi(key) else { return key }
        return ayEtiketiBicimi.string(from: date)
    }

    static func yuzde(_ value: Int, of total: Int) -> Int {
        guard total > 0 else { return 0 }
        return Int((Double(value) / Double(total) * 100).rounded())
    }
}
