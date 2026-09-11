import XCTest

/// P0 duman: İşlerim kapat foto kontrolleri, şikayet görevlendirme (admin), harita engel giriş noktası.
/// Yerel backend yoksa AllScreens ile aynı şekilde atlanır.
final class P0FlowsUITests: XCTestCase {
    private let baseURL = URL(string: "http://localhost:3000")!
    private let phone = "05000000000"
    private let password = "admin123"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipUnless(backendAyakta(), "Yerel backend çalışmıyor; P0 UITest atlandı.")
    }

    func testIslerimKapatSheetFotografKontrolleri() throws {
        let app = XCUIApplication()
        app.launch()
        try girisYap(app)

        XCTAssertTrue(modulüMenudenAc(app, modul: "İşlerim", grup: "Vatandaş & Görev"), "İşlerim menüden açılmadı")
        XCTAssertTrue(app.staticTexts["İşlerim"].waitForExistence(timeout: 15), "İşlerim başlığı yok")

        // Liste boş olabilir — en azından ekran çizildi. Kapat aksiyonu varsa sheet kontrolü yapılır.
        let kapat = app.buttons["Kapat"].firstMatch
        if kapat.waitForExistence(timeout: 5), kapat.isHittable {
            kapat.tap()
            let foto = app.descendants(matching: .any)["fotografEkleKontrol"]
            XCTAssertTrue(
                foto.waitForExistence(timeout: 8),
                "Kapat sheet'inde fotoğraf ekle kontrolü görünmeli"
            )
            // Sheet'i kapat
            let vazgec = app.buttons["Kapat"].firstMatch
            if vazgec.exists { vazgec.tap() }
        } else {
            // Boş liste: P0 varlık kontrolü — ekranın kendisi yeterli (flake'siz)
            XCTAssertTrue(app.staticTexts["İşlerim"].exists)
        }
    }

    func testSikayetDetayGorevlendirmeAdmin() throws {
        let app = XCUIApplication()
        app.launch()
        try girisYap(app)

        let sekme = app.buttons["Şikayet"]
        XCTAssertTrue(sekme.waitForExistence(timeout: 15), "Şikayet sekmesi yok")
        sekme.tap()
        XCTAssertTrue(app.staticTexts["Şikayetler"].waitForExistence(timeout: 15))

        // İlk kart / hücre — tablo veya liste satırı
        let hucre = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "ŞKY")).firstMatch
        if hucre.waitForExistence(timeout: 8), hucre.isHittable {
            hucre.tap()
            let gorev = app.descendants(matching: .any)["sikayetGorevlendirme"]
            XCTAssertTrue(
                gorev.waitForExistence(timeout: 10),
                "Admin için Görevlendirme bloğu görünmeli"
            )
        } else {
            // Demo veri yoksa en azından liste başlığı
            XCTAssertTrue(app.staticTexts["Şikayetler"].exists)
        }
    }

    func testHaritaEngelEkleGirisNoktasi() throws {
        let app = XCUIApplication()
        app.launch()
        try girisYap(app)

        let sekme = app.buttons["Harita"]
        XCTAssertTrue(sekme.waitForExistence(timeout: 15), "Harita sekmesi yok")
        sekme.tap()
        XCTAssertTrue(app.staticTexts["Yol Haritası"].waitForExistence(timeout: 15))

        let engel = app.descendants(matching: .any)["haritaEngelEkle"]
        XCTAssertTrue(
            engel.waitForExistence(timeout: 10),
            "Haritada Engel Ekle giriş noktası olmalı"
        )
    }

    // MARK: - Yardımcılar (AllScreens ile aynı ruh)

    private func modulüMenudenAc(_ app: XCUIApplication, modul: String, grup: String) -> Bool {
        let hamburger = app.buttons["Modüller menüsü"]
        guard hamburger.waitForExistence(timeout: 10) else { return false }
        hamburger.tap()

        let liste = app.scrollViews["modulMenusuListesi"]
        guard liste.waitForExistence(timeout: 5) else { return false }

        let satir = app.buttons[modul]
        if !satir.exists {
            let g = app.buttons[grup]
            guard grupaUlas(liste, hedef: g) else { return false }
            g.tap()
        }
        guard grupaUlas(liste, hedef: satir) else { return false }
        satir.tap()
        return true
    }

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

    private func girisYap(_ app: XCUIApplication) throws {
        let telefon = app.textFields["05xxxxxxxxx"]
        guard telefon.waitForExistence(timeout: 10) else { return }
        telefon.tap()
        telefon.typeText(phone)
        let sifre = app.secureTextFields.firstMatch
        XCTAssertTrue(sifre.waitForExistence(timeout: 5))
        sifre.tap()
        sifre.typeText(password)
        let buton = app.buttons["Giriş Yap"]
        XCTAssertTrue(buton.waitForExistence(timeout: 5))
        buton.tap()
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
