import XCTest

/// Her panel ekranını açar, sayfa başlığının çizildiğini doğrular ve ekran
/// görüntüsünü test sonucuna ekler. Alt çubuktaki beş sekme doğrudan, kalan
/// modüller başlıktaki menüden açılır.
///
/// Yerel backend (`npm run dev`) ve demo veri gerektirir; backend ayakta değilse atlanır.
final class AllScreensUITests: XCTestCase {
    private let baseURL = URL(string: "http://localhost:3000")!
    private let phone = "05000000000"
    private let password = "admin123"

    /// Menüdeki satır etiketi (`NavDestination.label`) ile ekranın kendi
    /// `KBPageHeader` başlığı farklı olabildiği için ikisi ayrı tutulur.
    /// `grup` menüde hangi bölümün açılacağını söyler; sekmelerde boştur.
    private struct Ekran {
        let modulEtiketi: String
        let sayfaBasligi: String
        var grup: String = ""
    }

    /// ADMIN rolünde alt sekme çubuğundakiler; etiketleri `shortLabel`.
    private let sekmeEkranlari: [Ekran] = [
        Ekran(modulEtiketi: "Şikayet", sayfaBasligi: "Şikayetler"),
        Ekran(modulEtiketi: "Görev", sayfaBasligi: "Görevlendirme"),
        Ekran(modulEtiketi: "Araçlar", sayfaBasligi: "Araç Envanteri"),
        Ekran(modulEtiketi: "Harita", sayfaBasligi: "Yol Haritası"),
    ]

    private let modulEkranlari: [Ekran] = [
        Ekran(modulEtiketi: "Komuta Ekranı", sayfaBasligi: "Komuta", grup: "Operasyon"),
        Ekran(modulEtiketi: "Raporlar", sayfaBasligi: "Raporlar", grup: "Operasyon"),
        Ekran(modulEtiketi: "İşlerim", sayfaBasligi: "İşlerim", grup: "Vatandaş & Görev"),
        Ekran(modulEtiketi: "WhatsApp Kuyruğu", sayfaBasligi: "WhatsApp Kuyruğu", grup: "Vatandaş & Görev"),
        Ekran(modulEtiketi: "Kontrol Listeleri", sayfaBasligi: "Kontrol Listeleri", grup: "Vatandaş & Görev"),
        Ekran(modulEtiketi: "Parsel Sorgu", sayfaBasligi: "Parsel Sorgu", grup: "Saha & Harita"),
        Ekran(modulEtiketi: "Kış Operasyonu", sayfaBasligi: "Kış Operasyonu", grup: "Saha & Harita"),
        Ekran(modulEtiketi: "Çöp Toplama", sayfaBasligi: "Çöp Toplama", grup: "Saha & Harita"),
        Ekran(modulEtiketi: "Yol Temizliği", sayfaBasligi: "Yol Temizliği", grup: "Saha & Harita"),
        Ekran(modulEtiketi: "Bakım Takip", sayfaBasligi: "Bakım Takip", grup: "Filo & Üretim"),
        Ekran(modulEtiketi: "Yakıt Takip", sayfaBasligi: "Yakıt Takip", grup: "Filo & Üretim"),
        Ekran(modulEtiketi: "Akaryakıt Analizi", sayfaBasligi: "Akaryakıt Analizi", grup: "Filo & Üretim"),
        Ekran(modulEtiketi: "Malzeme / Depo", sayfaBasligi: "Malzeme / Depo", grup: "Filo & Üretim"),
        Ekran(modulEtiketi: "Beton Reçeteleri", sayfaBasligi: "Beton Reçeteleri", grup: "Filo & Üretim"),
        Ekran(modulEtiketi: "Agrega Maliyet", sayfaBasligi: "Agrega Maliyet", grup: "Filo & Üretim"),
        Ekran(modulEtiketi: "Bitüm Takip", sayfaBasligi: "Bitüm Takip", grup: "Filo & Üretim"),
        Ekran(modulEtiketi: "Personel", sayfaBasligi: "Personel", grup: "Kurum Yönetimi"),
        Ekran(modulEtiketi: "Günlük Çalışma", sayfaBasligi: "Günlük Çalışma", grup: "Kurum Yönetimi"),
        Ekran(modulEtiketi: "Tanımlar & Yönetim", sayfaBasligi: "Tanımlar", grup: "Kurum Yönetimi"),
        Ekran(modulEtiketi: "Denetim İzi", sayfaBasligi: "Denetim İzi", grup: "Kurum Yönetimi"),
    ]

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipUnless(backendAyakta(), "Yerel backend çalışmıyor; ekran tarama testi atlandı.")
    }

    func testTumEkranlarKitDiliyleCizilir() throws {
        let app = XCUIApplication()
        app.launch()
        try girisYap(app)

        let hamburger = app.buttons["Modüller menüsü"]
        XCTAssertTrue(hamburger.waitForExistence(timeout: 25), "Marka bandı görünmedi")

        var acilmayan: [String] = []

        for ekran in sekmeEkranlari {
            let sekme = app.buttons[ekran.modulEtiketi]
            guard sekme.waitForExistence(timeout: 5) else {
                acilmayan.append("sekme: \(ekran.modulEtiketi)")
                continue
            }
            sekme.tap()
            acilmayan.append(contentsOf: basligiDogrula(app, ekran: ekran))
        }

        for ekran in modulEkranlari {
            guard modulüMenudenAc(app, ekran: ekran) else {
                acilmayan.append("menü: \(ekran.modulEtiketi)")
                menuyuKapat(app)
                continue
            }
            acilmayan.append(contentsOf: basligiDogrula(app, ekran: ekran))
        }

        XCTAssertTrue(
            acilmayan.isEmpty,
            "Şu ekranlar açılmadı veya başlığı çizilmedi: \(acilmayan.joined(separator: ", "))"
        )
    }

    /// Sayfa başlığının çizilmesini bekler ve kareyi ekler; başlık gelmezse hata
    /// karesi alıp adı geri döner.
    private func basligiDogrula(_ app: XCUIApplication, ekran: Ekran) -> [String] {
        guard app.staticTexts[ekran.sayfaBasligi].waitForExistence(timeout: 15) else {
            ekranGoruntusu(app, adi: "HATA-\(ekran.sayfaBasligi)")
            return [ekran.sayfaBasligi]
        }
        // Liste veya boş durum yerleşene kadar kısa bir bekleme, sonra kare.
        Thread.sleep(forTimeInterval: 1.5)
        ekranGoruntusu(app, adi: ekran.sayfaBasligi)
        return []
    }

    // MARK: - Yardımcılar

    /// Menüyü açar, modülün bölümünü genişletir ve satırına dokunur. Modül seçimi
    /// yığının kökünü değiştirdiği için geri dönmeye gerek kalmaz.
    private func modulüMenudenAc(_ app: XCUIApplication, ekran: Ekran) -> Bool {
        let hamburger = app.buttons["Modüller menüsü"]
        guard hamburger.waitForExistence(timeout: 10) else { return false }
        hamburger.tap()

        let liste = app.scrollViews["modulMenusuListesi"]
        guard liste.waitForExistence(timeout: 5) else { return false }

        let satir = app.buttons[ekran.modulEtiketi]

        // Menüde aynı anda tek bölüm açık kalır; satır görünmüyorsa bölümü aç.
        if !satir.exists {
            let grup = app.buttons[ekran.grup]
            guard grupaUlas(liste, hedef: grup) else { return false }
            grup.tap()
        }

        guard grupaUlas(liste, hedef: satir) else { return false }
        satir.tap()
        return true
    }

    /// Hedef menüde aşağıda kalmış olabilir; listeyi başa sarıp dokunulabilir
    /// olana kadar aşağı kaydırır.
    private func grupaUlas(_ liste: XCUIElement, hedef: XCUIElement) -> Bool {
        for _ in 0..<6 where !(hedef.exists && hedef.isHittable) {
            liste.swipeDown(velocity: .fast)
        }
        for _ in 0..<10 {
            if hedef.exists && hedef.isHittable { return true }
            liste.swipeUp(velocity: .slow)
        }
        return false
    }

    private func menuyuKapat(_ app: XCUIApplication) {
        let kapat = app.buttons["Menüyü kapat"]
        if kapat.exists && kapat.isHittable { kapat.tap() }
    }

    private func girisYap(_ app: XCUIApplication) throws {
        let telefon = app.textFields["05xxxxxxxxx"]
        guard telefon.waitForExistence(timeout: 10) else { return }

        telefon.tap()
        telefon.typeText(phone)

        let sifre = app.secureTextFields.firstMatch
        XCTAssertTrue(sifre.waitForExistence(timeout: 5), "Şifre alanı bulunamadı")
        sifre.tap()
        sifre.typeText(password)

        let buton = app.buttons["Giriş Yap"]
        XCTAssertTrue(buton.waitForExistence(timeout: 5), "Giriş butonu bulunamadı")
        buton.tap()
    }

    private func ekranGoruntusu(_ app: XCUIApplication, adi: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = adi
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func backendAyakta() -> Bool {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/v1/dashboard"))
        request.timeoutInterval = 3

        var ulasildi = false
        let bekle = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { _, response, _ in
            ulasildi = (response as? HTTPURLResponse) != nil
            bekle.signal()
        }.resume()
        _ = bekle.wait(timeout: .now() + 5)
        return ulasildi
    }
}
