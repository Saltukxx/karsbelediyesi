import XCTest

/// Marka bandındaki hamburgerin açtığı modül menüsünü doğrular: hızlı erişim,
/// grup bölümleri, çıkış bandı ve seçimin doğru ekrana götürmesi.
final class ModuleDrawerUITests: XCTestCase {
    private let baseURL = URL(string: "http://localhost:3000")!
    private let phone = "05000000000"
    private let password = "admin123"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipUnless(backendAyakta(), "Yerel backend çalışmıyor; menü testi atlandı.")
    }

    func testMenuAcilirVeModuleGoturur() throws {
        let app = XCUIApplication()
        app.launch()
        try girisYap(app)

        let hamburger = app.buttons["Modüller menüsü"]
        XCTAssertTrue(hamburger.waitForExistence(timeout: 25), "Hamburger düğmesi görünmedi")
        hamburger.tap()

        XCTAssertTrue(app.staticTexts["Modüller"].waitForExistence(timeout: 5), "Menü açılmadı")
        Thread.sleep(forTimeInterval: 1)
        ekranGoruntusu(app, adi: "menu-acik")
        // Hızlı erişim ızgarası favorileri modül kutucuğu olarak basar.
        XCTAssertTrue(app.buttons["Şikayet Kayıt & Takip"].exists, "Hızlı erişim kutucuğu yok")
        XCTAssertTrue(app.buttons["Çıkış Yap"].exists, "Çıkış bandı yok")

        // Varsayılan açık grup dışındaki bir bölüm açılıp modüle gidilebiliyor mu.
        let bolum = app.buttons["Filo & Üretim"]
        XCTAssertTrue(bolum.waitForExistence(timeout: 5), "Grup başlığı bulunamadı")
        bolum.tap()

        // Açılan bölüm katlamanın altında kalıyor; dokunulabilir olana kadar kaydırılır.
        let modul = app.buttons["Bakım Takip"]
        XCTAssertTrue(modul.waitForExistence(timeout: 5), "Modül satırı açılmadı")
        let menuScroll = app.scrollViews["modulMenusuListesi"]
        for _ in 0..<6 where !modul.isHittable {
            menuScroll.swipeUp(velocity: .slow)
        }
        XCTAssertTrue(modul.isHittable, "Modül satırı ekrana getirilemedi")
        ekranGoruntusu(app, adi: "menu-grup-acik")
        modul.tap()

        XCTAssertTrue(
            app.staticTexts["Bakım Takip"].waitForExistence(timeout: 15),
            "Menüden seçilen modül açılmadı"
        )
        XCTAssertFalse(app.buttons["Çıkış Yap"].exists, "Menü seçimden sonra kapanmadı")
        Thread.sleep(forTimeInterval: 1)
        ekranGoruntusu(app, adi: "menuden-acilan-ekran")
    }

    // MARK: - Yardımcılar

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
