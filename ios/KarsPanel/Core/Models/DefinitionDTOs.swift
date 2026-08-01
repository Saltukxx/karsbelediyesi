import Foundation

/// `/tanimlar` ekranının veri kümesi. Web sayfası gibi pasif kayıtları da içerir.
struct TanimlarDTO: Decodable {
    let mahalleler: [TanimOgesiDTO]
    let mudurlukler: [MudurlukTanimDTO]
    let sikayetTurleri: [SikayetTuruTanimDTO]
    let aracCinsleri: [TanimOgesiDTO]
    let kullanicilar: [PanelKullaniciDTO]
    let otomatikAtama: Bool
}

struct TanimOgesiDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let aktif: Bool
}

struct MudurlukTanimDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let shortName: String
    let aktif: Bool
}

struct SikayetTuruTanimDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let aktif: Bool
    let defaultDepartmentId: String?
}

struct PanelKullaniciDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let phone: String
    let email: String?
    let role: UserRole
    let departmentId: String?
    let aktif: Bool
    let lastLoginAt: Date?
}

// MARK: - İstekler

struct AdRequestDTO: Encodable {
    let name: String
}

struct MudurlukRequestDTO: Encodable {
    let name: String
    let shortName: String?
    let aktif: Bool
}

struct SikayetTuruRequestDTO: Encodable {
    let name: String
    let defaultDepartmentId: String?
    let aktif: Bool
}

struct KullaniciOlusturRequestDTO: Encodable {
    let name: String
    let phone: String
    let email: String?
    let password: String
    let role: String
    let departmentId: String?
}

struct KullaniciGuncelleRequestDTO: Encodable {
    let name: String
    let phone: String
    /// Her zaman gönderilir: boş metin "e-postayı temizle" anlamına gelir.
    /// Alan hiç gönderilmezse sunucu mevcut değeri korur.
    let email: String
    let role: String
    let departmentId: String?
    let aktif: Bool
    /// Boş bırakılırsa şifre değişmez
    let password: String?
}

struct DispatchAyarRequestDTO: Encodable {
    let otomatikAtama: Bool
}

struct DispatchAyarDTO: Decodable {
    let otomatikAtama: Bool
}

// MARK: - Doğrulama

/// Web ile aynı şifre politikası; sunucuya gitmeden önce kullanıcıya söylenir.
enum SifrePolitikasi {
    static func hata(_ sifre: String) -> String? {
        if sifre.count < 8 { return "Şifre en az 8 karakter olmalı" }
        if sifre.rangeOfCharacter(from: .letters) == nil {
            return "Şifre en az bir harf içermeli"
        }
        if sifre.rangeOfCharacter(from: .decimalDigits) == nil {
            return "Şifre en az bir rakam içermeli"
        }
        return nil
    }
}

enum KullaniciFormValidation {
    /// Sunucu şemasıyla aynı kurallar: ad, en az 10 haneli telefon, müdürlük
    /// yöneticisi için müdürlük zorunlu, şifre politikası.
    static func hata(
        ad: String,
        telefon: String,
        rol: UserRole,
        departmentId: String?,
        sifre: String,
        sifreZorunlu: Bool
    ) -> String? {
        if ad.trimmingCharacters(in: .whitespaces).isEmpty { return "Ad zorunlu" }
        // Sunucu şeması da kırpılmış uzunluğa bakar; boşluklu yazımlar aynı kabul
        // edilsin diye burada da hane sayısı değil karakter sayısı sayılır.
        if telefon.trimmingCharacters(in: .whitespaces).count < 10 {
            return "Telefon en az 10 hane olmalı"
        }
        if rol == .DEPARTMENT_MANAGER, (departmentId ?? "").isEmpty {
            return "Müdürlük yöneticisi için müdürlük zorunlu"
        }
        if sifreZorunlu || !sifre.isEmpty {
            return SifrePolitikasi.hata(sifre)
        }
        return nil
    }
}
