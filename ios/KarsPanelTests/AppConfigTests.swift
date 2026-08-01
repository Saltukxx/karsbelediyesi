import XCTest
@testable import KarsPanel

final class AppConfigTests: XCTestCase {
    func testSchemeEksikAdresHttpsVarsayar() {
        XCTAssertEqual(
            AppConfig.normalize("panel.kars.bel.tr")?.absoluteString,
            "https://panel.kars.bel.tr"
        )
    }

    func testYolVeSorguAtilir() {
        XCTAssertEqual(
            AppConfig.normalize("https://panel.kars.bel.tr/giris?x=1#y")?.absoluteString,
            "https://panel.kars.bel.tr"
        )
    }

    func testYerelHttpAdresiKorunur() {
        XCTAssertEqual(
            AppConfig.normalize("http://localhost:3000")?.absoluteString,
            "http://localhost:3000"
        )
    }

    func testBosVeGecersizAdresReddedilir() {
        XCTAssertNil(AppConfig.normalize(""))
        XCTAssertNil(AppConfig.normalize("   "))
        XCTAssertNil(AppConfig.normalize("https://"))
        // Yalnızca http/https kabul edilir — javascript:, file: vb. engellenir
        XCTAssertNil(AppConfig.normalize("ftp://panel.kars.bel.tr"))
        XCTAssertNil(AppConfig.normalize("javascript://alert(1)"))
    }

    func testAlanAdiOlmayanGirdiReddedilir() {
        // URLComponents bunları host olarak kabul eder; kendi doğrulamamız elemeli
        XCTAssertNil(AppConfig.normalize("!!!"))
        XCTAssertNil(AppConfig.normalize("panel..kars"))
        XCTAssertNil(AppConfig.normalize("-panel.kars.bel.tr"))
        XCTAssertNil(AppConfig.normalize(".panel"))
    }

    func testIpAdresiVePortKabulEdilir() {
        XCTAssertEqual(
            AppConfig.normalize("http://192.168.1.40:3000")?.absoluteString,
            "http://192.168.1.40:3000"
        )
    }

    func testKullaniciGecersizKilmasiOncelikli() {
        let defaults = Self.makeDefaults()
        defer { Self.clear(defaults) }

        XCTAssertEqual(AppConfig.resolvedBaseURL(defaults: defaults), AppConfig.bundledBaseURL)

        AppConfig.setBaseURLOverride("test.kars.bel.tr", defaults: defaults)
        XCTAssertEqual(
            AppConfig.resolvedBaseURL(defaults: defaults).absoluteString,
            "https://test.kars.bel.tr"
        )

        AppConfig.setBaseURLOverride(nil, defaults: defaults)
        XCTAssertEqual(AppConfig.resolvedBaseURL(defaults: defaults), AppConfig.bundledBaseURL)
    }

    func testGecersizGecersizKilmaKaydedilmez() {
        let defaults = Self.makeDefaults()
        defer { Self.clear(defaults) }

        AppConfig.setBaseURLOverride("!!!", defaults: defaults)
        XCTAssertNil(defaults.string(forKey: AppConfig.overrideDefaultsKey))
    }

    private static func makeDefaults() -> UserDefaults {
        let suite = UserDefaults(suiteName: "AppConfigTests")!
        clear(suite)
        return suite
    }

    private static func clear(_ defaults: UserDefaults) {
        defaults.removeObject(forKey: AppConfig.overrideDefaultsKey)
    }
}
