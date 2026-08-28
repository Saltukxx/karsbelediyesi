import XCTest

/// Liste uçları 200 satırda kesiyor. Bu test kesildiğinin kullanıcıya söylendiğini ve
/// "Daha fazla yükle" ile listenin gerçekten büyüdüğünü doğrular.
final class LoadMoreUITests: XCTestCase {
    private let baseURL = URL(string: "http://localhost:3000")!
    private let phone = "05000000000"
    private let password = "admin123"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipUnless(backendAyakta(), "Yerel backend çalışmıyor; sayfalama testi atlandı.")
    }

    func testSikayetlerdeDahaFazlaYukleListeyiBuyutur() throws {
        let app = XCUIApplication()
        app.launch()
        try girisYap(app)

        let sikayetSekmesi = app.buttons["Şikayet"]
        XCTAssertTrue(sikayetSekmesi.waitForExistence(timeout: 25), "Alt sekme çubuğu görünmedi")
        sikayetSekmesi.tap()

        // "Tümü" 200 satır sınırına dayanacak kadar kayıt içeren tek sekme.
        let tumu = app.buttons["Tümü"]
        XCTAssertTrue(tumu.waitForExistence(timeout: 15), "Şikayet sekmeleri görünmedi")
        tumu.tap()

        let ilkMetin = try seridiBul(app, "İlk sayfada")
        XCTAssertTrue(ilkMetin.contains("200 şikayet"), "İlk sayfada 200 kayıt bekleniyordu: \(ilkMetin)")
        ekranGoruntusu(app, adi: "sayfalama-serit")

        let dahaFazla = app.buttons["Daha fazla yükle"]
        XCTAssertTrue(dahaFazla.waitForExistence(timeout: 5), "Daha fazla yükle düğmesi yok")
        dahaFazla.tap()

        // Sınır 400'e çıkınca şerit 200 kart daha aşağı iner; tembel yığında yeniden aranmalı.
        let ikinciMetin = try seridiBul(app, "İkinci sayfada")
        XCTAssertTrue(
            ikinciMetin.contains("400 şikayet"),
            "Daha fazla yükle sonrası 400 kayıt bekleniyordu: \(ikinciMetin)"
        )
        ekranGoruntusu(app, adi: "sayfalama-buyudu")
    }

    // MARK: - Yardımcılar

    /// Şerit listenin en altında ve `LazyVStack` içinde; ekrana girene kadar kaydırılır.
    private func seridiBul(_ app: XCUIApplication, _ asama: String) throws -> String {
        let liste = app.scrollViews.firstMatch
        let serit = kesmeSeridi(app)
        for _ in 0..<80 {
            if serit.exists, serit.isHittable { return serit.label }
            liste.swipeUp(velocity: .fast)
        }
        XCTFail("\(asama) kesme bildirimi ekrana getirilemedi")
        return ""
    }

    private func kesmeSeridi(_ app: XCUIApplication) -> XCUIElement {
        app.staticTexts.containing(
            NSPredicate(format: "label BEGINSWITH 'İlk' AND label CONTAINS 'gösteriliyor'")
        ).firstMatch
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
