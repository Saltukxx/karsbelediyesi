import Foundation

enum KBNumberFormat {
    /// Türkçe klavyeden gelen virgüllü değeri de okur; boşsa nil.
    static func parse(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return Double(trimmed.replacingOccurrences(of: ",", with: "."))
    }

    static func parseInt(_ text: String) -> Int? {
        guard let value = parse(text), value == value.rounded() else { return nil }
        return Int(value)
    }

    /// Alan boş değil ama sayıya çevrilemiyorsa doğrulama hatası verilir.
    static func isInvalid(_ text: String) -> Bool {
        !text.trimmingCharacters(in: .whitespaces).isEmpty && parse(text) == nil
    }

    static func text(_ value: Double?) -> String {
        guard let value else { return "" }
        if value == value.rounded(), abs(value) < 1e15 {
            return String(Int(value))
        }
        return String(value)
    }

    static let currency: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "tr_TR")
        f.maximumFractionDigits = 2
        return f
    }()

    static func para(_ value: Double?) -> String {
        guard let value else { return "—" }
        return (currency.string(from: NSNumber(value: value)) ?? "\(value)") + " ₺"
    }

    static func miktar(_ value: Double?, birim: String? = nil) -> String {
        guard let value else { return "—" }
        let text = currency.string(from: NSNumber(value: value)) ?? "\(value)"
        guard let birim, !birim.isEmpty else { return text }
        return "\(text) \(birim)"
    }

    static func yuzde(_ value: Double?) -> String {
        guard let value else { return "—" }
        return (currency.string(from: NSNumber(value: value)) ?? "\(value)") + " %"
    }
}

/// Takip raporundaki süreler dakika cinsinden gelir; 60 dakikayı aşanlar
/// "1 sa 20 dk" biçiminde okunur (web `sureMetni` ile aynı).
enum KBDurationFormat {
    static func dakika(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "—" }
        let toplam = Int(value.rounded())
        if toplam < 60 { return "\(toplam) dk" }
        let saat = toplam / 60
        let kalan = toplam % 60
        return kalan == 0 ? "\(saat) sa" : "\(saat) sa \(kalan) dk"
    }

    static func saat(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "—" }
        return dakika(value * 60)
    }
}

extension DateFormatter {
    static let kbDay: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "tr_TR")
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    /// Görev çıkış/giriş gibi saat bilgisi taşıyan alanlar
    static let kbDateTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "tr_TR")
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    /// Zaman çizelgesi satırları aynı gün içinde olduğu için yalnızca saat
    static let kbTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "tr_TR")
        f.dateStyle = .none
        f.timeStyle = .short
        return f
    }()

    /// Sunucunun tarih filtrelerinde beklediği biçim
    static let kbIsoDay: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Europe/Istanbul")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}

extension Date {
    var kbGun: String { DateFormatter.kbDay.string(from: self) }
    var kbAn: String { DateFormatter.kbDateTime.string(from: self) }
    var kbSaat: String { DateFormatter.kbTime.string(from: self) }
    var kbIsoGun: String { DateFormatter.kbIsoDay.string(from: self) }
    /// Sunucunun `z.coerce.date()` ile okuduğu tam zaman damgası
    var kbIsoAn: String { ISO8601DateFormatter.kbFull.string(from: self) }
}

extension Optional where Wrapped == Date {
    var kbGun: String { self?.kbGun ?? "—" }
    var kbAn: String { self?.kbAn ?? "—" }
}

extension ISO8601DateFormatter {
    static let kbFull = ISO8601DateFormatter()
}

/// Takip raporu olayları epoch milisaniye taşır.
extension Double {
    var kbEpochMsSaat: String { Date(timeIntervalSince1970: self / 1000).kbSaat }
    var kbEpochMsAn: String { Date(timeIntervalSince1970: self / 1000).kbAn }
}
