import XCTest
import UIKit
@testable import KarsPanel

final class KBPhotoUploadTests: XCTestCase {
    private func gorsel(_ boyut: CGSize) -> UIImage {
        UIGraphicsImageRenderer(size: boyut).image { ctx in
            UIColor.systemTeal.setFill()
            ctx.fill(CGRect(origin: .zero, size: boyut))
        }
    }

    func testUzunKenarSinirinUstundeyseKuculur() {
        let kucuk = KBPhotoUpload.downscaled(gorsel(CGSize(width: 4032, height: 3024)))

        XCTAssertEqual(kucuk.size.width, KBPhotoUpload.maxEdge, accuracy: 1)
        XCTAssertEqual(kucuk.size.height, 1200, accuracy: 1, "En-boy oranı korunmalı")
    }

    func testSinirAltindakiGorselDokunulmadanGecer() {
        let kaynak = gorsel(CGSize(width: 800, height: 600))
        let sonuc = KBPhotoUpload.downscaled(kaynak)

        XCTAssertEqual(sonuc.size, kaynak.size)
    }

    // Sunucu mime bilgisi gelmeyince gövdeyi jpeg sayıp .jpg olarak yazıyor; PNG/HEIC
    // gönderirsek tarayıcıda açılmayan dosya üretiyordu. Çıktı her zaman JPEG olmalı.
    func testCiktiJpegOlarakKodlanir() throws {
        let png = try XCTUnwrap(gorsel(CGSize(width: 300, height: 200)).pngData())
        let jpeg = try XCTUnwrap(KBPhotoUpload.jpegData(from: png))

        XCTAssertEqual(Array(jpeg.prefix(3)), [0xFF, 0xD8, 0xFF], "JPEG imzası bekleniyor")
    }

    func testBuyukGorselKucultulunceKayda_degerOlcudeUfalir() throws {
        let buyuk = try XCTUnwrap(gorsel(CGSize(width: 4032, height: 3024)).pngData())
        let jpeg = try XCTUnwrap(KBPhotoUpload.jpegData(from: buyuk))

        XCTAssertLessThan(jpeg.count, buyuk.count)
        XCTAssertLessThan(jpeg.count, 2 * 1024 * 1024, "Mobil hatta yüklenebilir boyutta kalmalı")
    }

    func testGorsel_olmayanVeriNilDoner() {
        XCTAssertNil(KBPhotoUpload.jpegData(from: Data("bu bir görsel değil".utf8)))
    }
}
