import XCTest
@testable import KarsPanel

final class KBSearchTests: XCTestCase {
    // Asıl sebep: "İVECO".lowercased() noktayı ayrı bir birleşim işaretine çevirdiği için
    // eski karşılaştırma "iveco" sorgusunu bulamıyordu.
    func testNoktaliBuyukIKucukIleEslesir() {
        XCTAssertTrue(KBSearch.eslesir("İVECO Daily", "iveco"))
        XCTAssertTrue(KBSearch.eslesir("İstasyon Caddesi", "istasyon"))
    }

    func testNoktasizBuyukIKucukIleEslesir() {
        XCTAssertTrue(KBSearch.eslesir("ISUZU NPR", "isuzu"))
    }

    func testBuyukKucukHarfDuyarsiz() {
        XCTAssertTrue(KBSearch.eslesir("36 ABC 123", "abc"))
        XCTAssertTrue(KBSearch.eslesir("yağ değişimi", "YAĞ"))
    }

    func testEslesmeyenMetinFalseDoner() {
        XCTAssertFalse(KBSearch.eslesir("Ford Transit", "mercedes"))
    }

    func testBosVeNilAlanEslesmez() {
        XCTAssertFalse(KBSearch.eslesir(nil, "abc"))
        XCTAssertFalse(KBSearch.eslesir("", "abc"))
    }

    func testAlanListesindeHerhangiBiriYeterli() {
        let alanlar: [String?] = [nil, "Ford", "Transit"]
        XCTAssertTrue(KBSearch.eslesir(alanlar, "transit"))
        XCTAssertFalse(KBSearch.eslesir(alanlar, "isuzu"))
    }
}
