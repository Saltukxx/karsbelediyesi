import XCTest
@testable import KarsPanel

final class KBPollTests: XCTestCase {
    func testAralikSapmaSinirlariIcindeKalir() {
        let taban = 30.0
        for _ in 0..<500 {
            let aralik = KBPoll.jitterliAralik(taban)
            XCTAssertGreaterThanOrEqual(aralik, taban * KBPoll.sapma.lowerBound)
            XCTAssertLessThanOrEqual(aralik, taban * KBPoll.sapma.upperBound)
        }
    }

    /// Asıl amaç: aynı anda açılan istemcilerin aynı saniyede istek atmayı
    /// sürdürmesini engellemek. Sabit bir değer dönseydi bu koruma yok olurdu.
    func testAralikTurdenTureDegisir() {
        let ornekler = Set((0..<50).map { _ in KBPoll.jitterliAralik(30) })
        XCTAssertGreaterThan(ornekler.count, 1, "Yoklama aralığı sabit kalıyor, dağıtma yok")
    }

    func testOrtalamaTabanAraligaYakinKalir() {
        let taban = 30.0
        let ornekler = (0..<2000).map { _ in KBPoll.jitterliAralik(taban) }
        let ortalama = ornekler.reduce(0, +) / Double(ornekler.count)
        // Sapma simetrik olduğu için ortalama tabana yakın olmalı; aksi halde
        // yoklama sıklığı istemeden artar ya da azalır.
        XCTAssertEqual(ortalama, taban, accuracy: taban * 0.05)
    }
}
