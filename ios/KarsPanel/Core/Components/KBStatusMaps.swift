import Foundation

/// API'den gelen durum kodlarını Türkçe etikete ve rozet tonuna çevirir.
/// Etiketler `packages/shared/src/constants.ts` ile hizalıdır; web'deki emoji önekleri
/// mobilde renkli rozetle karşılandığı için taşınmaz.
enum KBStatus {
    static func envanter(_ code: String?) -> KBBadge? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "AKTIF": return KBBadge(text: "Aktif", tone: .success)
        case "BAKIMDA": return KBBadge(text: "Bakımda", tone: .warning)
        case "ARIZALI": return KBBadge(text: "Arızalı", tone: .danger)
        case "HURDAYA_AYRILDI": return KBBadge(text: "Hurda", tone: .neutral)
        default: return KBBadge(text: pretty(code), tone: .neutral)
        }
    }

    static func operasyon(_ code: String?) -> KBBadge? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "MUSAIT": return KBBadge(text: "Müsait", tone: .success)
        case "GOREVDE": return KBBadge(text: "Görevde", tone: .info)
        case "BAKIMDA": return KBBadge(text: "Bakımda", tone: .warning)
        case "ARIZALI": return KBBadge(text: "Arızalı", tone: .danger)
        case "PLANLI_BAKIM": return KBBadge(text: "Planlı Bakım", tone: .accent)
        default: return KBBadge(text: pretty(code), tone: .neutral)
        }
    }

    static func bakim(_ code: String?) -> KBBadge? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "TAMAMLANDI": return KBBadge(text: "Tamamlandı", tone: .success)
        case "DEVAM_EDIYOR": return KBBadge(text: "Devam Ediyor", tone: .warning)
        case "PLANLANDI": return KBBadge(text: "Planlandı", tone: .info)
        default: return KBBadge(text: pretty(code), tone: .neutral)
        }
    }

    static func bakimTuru(_ code: String?) -> String? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "PERIYODIK": return "Periyodik Bakım"
        case "BUYUK_BAKIM": return "Büyük Bakım"
        case "ARIZA_ONARIMI": return "Arıza Onarımı"
        case "LASTIK": return "Lastik"
        case "YAG_DEGISIMI": return "Yağ Değişimi"
        case "DIGER": return "Diğer"
        default: return pretty(code)
        }
    }

    /// Araç görevi ve asfalt işi aynı durum sözlüğünü paylaşır.
    static func gorev(_ code: String?) -> KBBadge? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "PLANLANDI": return KBBadge(text: "Planlandı", tone: .info)
        case "DEVAM_EDIYOR": return KBBadge(text: "Devam Ediyor", tone: .warning)
        case "TAMAMLANDI": return KBBadge(text: "Tamamlandı", tone: .success)
        case "IPTAL_EDILDI", "IPTAL": return KBBadge(text: "İptal", tone: .neutral)
        default: return KBBadge(text: pretty(code), tone: .neutral)
        }
    }

    static func personel(_ code: String?) -> KBBadge? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "AKTIF": return KBBadge(text: "Aktif", tone: .success)
        case "IZINLI": return KBBadge(text: "İzinli", tone: .info)
        case "RAPORLU": return KBBadge(text: "Raporlu", tone: .warning)
        case "AYRILDI": return KBBadge(text: "Ayrıldı", tone: .neutral)
        default: return KBBadge(text: pretty(code), tone: .neutral)
        }
    }

    static func kontrolFormu(_ code: String?) -> KBBadge? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "TASLAK": return KBBadge(text: "Taslak", tone: .neutral)
        case "ONAY_BEKLIYOR": return KBBadge(text: "Onay Bekliyor", tone: .warning)
        case "ONAYLANDI": return KBBadge(text: "Onaylandı", tone: .success)
        case "REDDEDILDI": return KBBadge(text: "Reddedildi", tone: .danger)
        default: return KBBadge(text: pretty(code), tone: .neutral)
        }
    }

    static func whatsappOnay(_ code: String?) -> KBBadge? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "OTOMATIK": return KBBadge(text: "Otomatik", tone: .info)
        case "ONAY_BEKLIYOR": return KBBadge(text: "Onay Bekliyor", tone: .warning)
        case "ONAYLANDI": return KBBadge(text: "Onaylandı", tone: .success)
        case "REDDEDILDI": return KBBadge(text: "Reddedildi", tone: .danger)
        default: return KBBadge(text: pretty(code), tone: .neutral)
        }
    }

    static func denetimIslem(_ code: String?) -> KBBadge? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "GIRIS": return KBBadge(text: "Giriş", tone: .info)
        case "GIRIS_BASARISIZ": return KBBadge(text: "Başarısız Giriş", tone: .danger)
        case "SIKAYET_OLUSTUR": return KBBadge(text: "Şikayet Oluşturuldu", tone: .accent)
        case "SIKAYET_DURUM_GUNCELLE": return KBBadge(text: "Şikayet Durumu", tone: .info)
        case "SIKAYET_ATA": return KBBadge(text: "Şikayet Ataması", tone: .info)
        case "GOREV_OLUSTUR": return KBBadge(text: "Görev Oluşturuldu", tone: .accent)
        case "GOREV_BASLAT": return KBBadge(text: "Görev Başlatıldı", tone: .warning)
        case "GOREV_KAPAT": return KBBadge(text: "Görev Kapatıldı", tone: .success)
        case "KONTROL_FORMU_ONAYA_GONDER": return KBBadge(text: "Form Onaya Gönderildi", tone: .warning)
        case "KONTROL_FORMU_KARAR": return KBBadge(text: "Form Kararı", tone: .success)
        case "WHATSAPP_ONAYLA": return KBBadge(text: "WhatsApp Onaylandı", tone: .success)
        case "WHATSAPP_REDDET": return KBBadge(text: "WhatsApp Reddedildi", tone: .danger)
        case "KULLANICI_OLUSTUR": return KBBadge(text: "Kullanıcı Oluşturuldu", tone: .accent)
        case "KULLANICI_GUNCELLE": return KBBadge(text: "Kullanıcı Güncellendi", tone: .info)
        default: return KBBadge(text: pretty(code), tone: .neutral)
        }
    }

    /// Denetim kaydındaki Prisma model adını (`Complaint`, `VehicleTask`) okunur hale getirir.
    static func varlikAdi(_ raw: String?) -> String? {
        guard let raw = raw?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
        switch raw.lowercased() {
        case "complaint": return "Şikayet"
        case "vehicletask", "task": return "Görev"
        case "vehicle": return "Araç"
        case "user": return "Kullanıcı"
        case "personnel", "personel": return "Personel"
        case "checklistform", "vehiclechecklistform": return "Kontrol Formu"
        case "whatsappmessage": return "WhatsApp Mesajı"
        case "material": return "Malzeme"
        case "session", "auth": return "Oturum"
        default: return raw
        }
    }

    /// Web'deki `stokDurumu`: kritik eşik ve %30 üstü tampon.
    static func stok(miktar: Double?, kritik: Double?) -> KBBadge? {
        guard let miktar, let kritik, kritik > 0 else { return nil }
        if miktar <= kritik { return KBBadge(text: "Kritik", tone: .danger) }
        if miktar <= kritik * 1.3 { return KBBadge(text: "Dikkat", tone: .warning) }
        return KBBadge(text: "Normal", tone: .success)
    }

    static func kanal(_ code: String?) -> String? {
        guard let code = normalize(code) else { return nil }
        switch code {
        case "TELEFON": return "Telefon"
        case "WHATSAPP": return "WhatsApp"
        case "WEB": return "Web"
        default: return pretty(code)
        }
    }

    // MARK: - Yardımcılar

    private static func normalize(_ code: String?) -> String? {
        guard let code, !code.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return code.uppercased()
    }

    /// Bilinmeyen kodu okunur hale getirir: "PLANLI_BAKIM" -> "Planli Bakim"
    private static func pretty(_ code: String) -> String {
        code
            .split(separator: "_")
            .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
            .joined(separator: " ")
    }
}

/// Kart üzerindeki meta çiplerinde kullanılan ortak biçimlendirme.
enum KBFormat {
    private static let trLocale = Locale(identifier: "tr_TR")

    // Biçimlendirici kurmak pahalı bir işlem; bunlar kart başına birkaç meta çipte,
    // arama kutusuna basılan her harfte yeniden çalışıyor. Bir kez kurulup paylaşılırlar.
    private static let gunAy: DateFormatter = tarihBicimi("d MMM yyyy")
    private static let gunAySaat: DateFormatter = tarihBicimi("d MMM HH:mm")

    private static func tarihBicimi(_ desen: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = trLocale
        formatter.dateFormat = desen
        return formatter
    }

    private static let isoKesirli: ISO8601DateFormatter = {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return parser
    }()

    private static let isoSade: ISO8601DateFormatter = {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime]
        return parser
    }()

    static func tarih(_ date: Date?) -> String? {
        guard let date else { return nil }
        return gunAy.string(from: date)
    }

    /// API'den ham ISO-8601 metni olarak gelen zaman damgalarını okunur hale getirir.
    static func isoTarihSaat(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        guard let date = isoParse(raw) else { return raw }
        return gunAySaat.string(from: date)
    }

    private static func isoParse(_ raw: String) -> Date? {
        isoKesirli.date(from: raw) ?? isoSade.date(from: raw)
    }

    static func para(_ value: Double?) -> String? {
        guard let value else { return nil }
        return "\(ondalik(value, basamak: value < 100 ? 2 : 0)) ₺"
    }

    static func litre(_ value: Double?) -> String? {
        guard let value else { return nil }
        return "\(ondalik(value, basamak: 1)) L"
    }

    static func sayi(_ value: Double?, birim: String? = nil) -> String? {
        guard let value else { return nil }
        let gövde = ondalik(value, basamak: value.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 1)
        guard let birim, !birim.isEmpty else { return gövde }
        return "\(gövde) \(birim)"
    }

    /// Kullanılan basamak sayıları sınırlı (0, 1, 2); her biri için tek biçimlendirici tutulur.
    private static let ondalikBicimleri: [Int: NumberFormatter] = Dictionary(
        uniqueKeysWithValues: (0...2).map { ($0, sayiBicimi(basamak: $0)) }
    )

    private static func sayiBicimi(basamak: Int) -> NumberFormatter {
        let formatter = NumberFormatter()
        formatter.locale = trLocale
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = basamak
        return formatter
    }

    static func ondalik(_ value: Double, basamak: Int) -> String {
        let formatter = ondalikBicimleri[basamak] ?? sayiBicimi(basamak: basamak)
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    /// "08:00" gibi saat alanlarını olduğu gibi, boşsa nil döner.
    static func saat(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }
}
