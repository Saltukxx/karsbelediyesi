import XCTest

/// Her panel ekranını "Modüller" sekmesinden açar, sayfa başlığının çizildiğini
/// doğrular ve ekran görüntüsünü test sonucuna ekler.
///
/// Yerel backend (`npm run dev`) ve demo veri gerektirir; backend ayakta değilse atlanır.
final class AllScreensUITests: XCTestCase {
    private let baseURL = URL(string: "http://localhost:3000")!
    private let phone = "05000000000"
    private let password = "admin123"

    /// Modül kutucuğundaki etiket (`NavDestination.label`) ile ekranın kendi
    /// `KBPageHeader` başlığı farklı olabildiği için ikisi ayrı tutulur.
    private struct Ekran {
        let modulEtiketi: String
        let sayfaBasligi: String
    }

    /// ADMIN rolünde bu dördü alt sekme çubuğunda; modül ızgarasında görünmezler.
    private let sekmeEkranlari: [Ekran] = [
        Ekran(modulEtiketi: "Şikayet", sayfaBasligi: "Şikayetler"),
        Ekran(modulEtiketi: "Görev", sayfaBasligi: "Görevlendirme"),
        Ekran(modulEtiketi: "Araçlar", sayfaBasligi: "Araç Envanteri"),
    ]

    private let modulEkranlari: [Ekran] = [
        Ekran(modulEtiketi: "Komuta Ekranı", sayfaBasligi: "Komuta"),
        Ekran(modulEtiketi: "Yol Haritası", sayfaBasligi: "Yol Haritası"),
        Ekran(modulEtiketi: "Parsel Sorgu", sayfaBasligi: "Parsel Sorgu"),
        Ekran(modulEtiketi: "Kış Operasyonu", sayfaBasligi: "Kış Operasyonu"),
        Ekran(modulEtiketi: "Çöp Toplama", sayfaBasligi: "Çöp Toplama"),
        Ekran(modulEtiketi: "Yol Temizliği", sayfaBasligi: "Yol Temizliği"),
        Ekran(modulEtiketi: "Raporlar", sayfaBasligi: "Raporlar"),
        Ekran(modulEtiketi: "İşlerim", sayfaBasligi: "İşlerim"),
        Ekran(modulEtiketi: "WhatsApp Kuyruğu", sayfaBasligi: "WhatsApp Kuyruğu"),
        Ekran(modulEtiketi: "Kontrol Listeleri", sayfaBasligi: "Kontrol Listeleri"),
        Ekran(modulEtiketi: "Bakım Takip", sayfaBasligi: "Bakım Takip"),
        Ekran(modulEtiketi: "Yakıt Takip", sayfaBasligi: "Yakıt Takip"),
        Ekran(modulEtiketi: "Akaryakıt Analizi", sayfaBasligi: "Akaryakıt Analizi"),
        Ekran(modulEtiketi: "Malzeme / Depo", sayfaBasligi: "Malzeme / Depo"),
        Ekran(modulEtiketi: "Beton Reçeteleri", sayfaBasligi: "Beton Reçeteleri"),
        Ekran(modulEtiketi: "Agrega Maliyet", sayfaBasligi: "Agrega Maliyet"),
        Ekran(modulEtiketi: "Bitüm Takip", sayfaBasligi: "Bitüm Takip"),
        Ekran(modulEtiketi: "Personel", sayfaBasligi: "Personel"),
        Ekran(modulEtiketi: "Günlük Çalışma", sayfaBasligi: "Günlük Çalışma"),
        Ekran(modulEtiketi: "Tanımlar & Yönetim", sayfaBasligi: "Tanımlar"),
        Ekran(modulEtiketi: "Denetim İzi", sayfaBasligi: "Denetim İzi"),
    ]

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipUnless(backendAyakta(), "Yerel backend çalışmıyor; ekran tarama testi atlandı.")
    }

    func testTumEkranlarKitDiliyleCizilir() throws {
        let app = XCUIApplication()
        app.launch()
        try girisYap(app)

        let modullerSekmesi = app.buttons["Daha Fazla"]
        XCTAssertTrue(modullerSekmesi.waitForExistence(timeout: 25), "Alt sekme çubuğu görünmedi")

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
            modullerSekmesi.tap()
            guard modulKartiniAc(app, etiket: ekran.modulEtiketi) else {
                acilmayan.append("kutucuk: \(ekran.modulEtiketi)")
                continue
            }
            acilmayan.append(contentsOf: basligiDogrula(app, ekran: ekran))
            geriDon(app)
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

    /// Modül kutucuğu ızgarada aşağıda kalmış olabilir; ızgarayı başa sarıp
    /// kutucuk dokunulabilir olana kadar kaydırır.
    private func modulKartiniAc(_ app: XCUIApplication, etiket: String) -> Bool {
        let kart = app.buttons[etiket]
        let scroll = app.scrollViews.firstMatch
        guard scroll.waitForExistence(timeout: 10) else { return false }

        // Izgara önceki ziyaretten kaydırılmış kalmış olabilir.
        for _ in 0..<8 where !(kart.exists && kart.isHittable) {
            scroll.swipeDown(velocity: .fast)
        }

        for _ in 0..<10 {
            if kart.exists && kart.isHittable {
                kart.tap()
                return true
            }
            scroll.swipeUp(velocity: .slow)
        }
        return false
    }

    private func geriDon(_ app: XCUIApplication) {
        let geri = app.navigationBars.buttons.element(boundBy: 0)
        if geri.exists && geri.isHittable {
            geri.tap()
        }
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
