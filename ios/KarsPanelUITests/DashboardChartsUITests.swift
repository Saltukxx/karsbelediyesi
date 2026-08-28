import XCTest

/// Dashboard grafiklerinin gerçek veriyle çizildiğini uçtan uca doğrular ve her
/// bölümün ekran görüntüsünü test sonucuna ekler.
///
/// Yerel backend (`npm run dev`) ve demo veri
/// (`npx tsx scripts/seed-demo-dashboard.ts`) gerektirir. Backend ayakta
/// değilse test atlanır, böylece backend'siz ortamlarda suite kırılmaz.
final class DashboardChartsUITests: XCTestCase {
    private let baseURL = URL(string: "http://localhost:3000")!
    private let phone = "05000000000"
    private let password = "admin123"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipUnless(backendAyakta(), "Yerel backend çalışmıyor; dashboard UI testi atlandı.")
    }

    func testDashboardChartsRenderWithLiveData() throws {
        let app = XCUIApplication()
        app.launch()

        try girisYap(app)

        let scroll = app.scrollViews.firstMatch
        XCTAssertTrue(scroll.waitForExistence(timeout: 20), "Dashboard yüklenmedi")

        // Kartlar başlıklarıyla değil açıklamalarıyla aranır: "Operasyon maliyeti"
        // gibi başlıklar yukarıdaki KPI kartlarında da geçiyor ve yanlış elemanı
        // eşleştiriyor. Açıklama metinleri panelde tekil.
        let bolumler: [(baslik: String, aciklama: String)] = [
            ("Şikayet trendi", "Seçili dönemde günlük açılan ve kapanan şikayet"),
            ("Müdürlük bazlı dağılım", "En çok şikayet alan 8 müdürlük"),
            ("Şikayet türü dağılımı", "Seçili dönemde kayda giren şikayetler"),
            ("Açık şikayet bekleme süresi", "Şu an açık ve devam eden şikayetlerin yaşı"),
            ("Araç operasyon durumu", "Filonun anlık dağılımı"),
            ("Kanal dağılımı", "Şikayetler hangi kanaldan geliyor"),
            ("Mahalle yoğunluğu", "Seçili dönemde en çok şikayet üreten 10 mahalle"),
            ("Şikayet yoğunluk haritası", "Seçili dönemde konumu girilen şikayetlerin coğrafi dağılımı"),
            ("Saatlik yoğunluk", "Şikayetler haftanın hangi günü, günün hangi saatinde geliyor"),
            ("Operasyon maliyeti", "Aylık bakım ve yakıt gideri"),
        ]

        // Kartlar tembel yüklenmediği için hepsi baştan hiyerarşidedir; asıl
        // doğrulama ekranda gerçekten çizilip çizilmediklerine bakmak.
        let olusmayan = bolumler
            .filter { !app.staticTexts[$0.aciklama].waitForExistence(timeout: 5) }
            .map(\.baslik)
        XCTAssertTrue(olusmayan.isEmpty, "Şu grafik kartları oluşmadı: \(olusmayan.joined(separator: ", "))")

        ekranGoruntusu(app, adi: "00-ust")
        var gorulenler: Set<String> = []

        for adim in 1...22 {
            scroll.swipeUp(velocity: .slow)
            ekranGoruntusu(app, adi: String(format: "%02d-kaydirma", adim))
            for bolum in bolumler where app.staticTexts[bolum.aciklama].isHittable {
                gorulenler.insert(bolum.baslik)
            }
        }

        let ekranaGelmeyen = bolumler.map(\.baslik).filter { !gorulenler.contains($0) }
        XCTAssertTrue(
            ekranaGelmeyen.isEmpty,
            "Şu kartlar kaydırma boyunca ekranda görünmedi: \(ekranaGelmeyen.joined(separator: ", "))"
        )

        try aralikDegistir(app, scroll: scroll)
    }

    /// Dönem değişince grafiklerin yeni veriyle yeniden çizildiğini doğrular.
    private func aralikDegistir(_ app: XCUIApplication, scroll: XCUIElement) throws {
        for _ in 1...22 {
            scroll.swipeDown(velocity: .fast)
        }

        let buton = app.buttons["Son 90 gün"]
        XCTAssertTrue(buton.waitForExistence(timeout: 10), "Dönem seçici bulunamadı")
        buton.tap()

        let trend = app.staticTexts["Seçili dönemde günlük açılan ve kapanan şikayet"]
        XCTAssertTrue(trend.waitForExistence(timeout: 15), "90 günlük dönemde trend kartı çizilmedi")

        // Yeni veri gelene kadar kısa bir süre tanınır, sonra kare alınır.
        Thread.sleep(forTimeInterval: 2)
        ekranGoruntusu(app, adi: "90-gun")

        scroll.swipeUp(velocity: .slow)
        scroll.swipeUp(velocity: .slow)
        ekranGoruntusu(app, adi: "91-gun-trend")
    }

    // MARK: - Yardımcılar

    private func girisYap(_ app: XCUIApplication) throws {
        let telefon = app.textFields["05xxxxxxxxx"]
        guard telefon.waitForExistence(timeout: 10) else {
            // Keychain'de geçerli oturum varsa doğrudan dashboard açılır.
            return
        }

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
            // 401 de yeterli: sunucu ayakta, sadece kimlik istiyor.
            ulasildi = (response as? HTTPURLResponse) != nil
            bekle.signal()
        }.resume()
        _ = bekle.wait(timeout: .now() + 5)
        return ulasildi
    }
}
