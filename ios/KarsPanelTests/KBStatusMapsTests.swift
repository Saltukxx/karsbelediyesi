import XCTest
@testable import KarsPanel

final class KBStatusMapsTests: XCTestCase {
    func testEnvanterDurumlariEtiketVeTonaCevrilir() {
        XCTAssertEqual(KBStatus.envanter("AKTIF")?.text, "Aktif")
        XCTAssertEqual(KBStatus.envanter("AKTIF")?.tone, .success)
        XCTAssertEqual(KBStatus.envanter("ARIZALI")?.tone, .danger)
        XCTAssertEqual(KBStatus.envanter("HURDAYA_AYRILDI")?.text, "Hurda")
    }

    func testOperasyonDurumuEmojisizEtiketDoner() {
        XCTAssertEqual(KBStatus.operasyon("MUSAIT")?.text, "Müsait")
        XCTAssertEqual(KBStatus.operasyon("GOREVDE")?.tone, .info)
        XCTAssertEqual(KBStatus.operasyon("PLANLI_BAKIM")?.text, "Planlı Bakım")
    }

    func testGorevVeKontrolDurumlari() {
        XCTAssertEqual(KBStatus.gorev("DEVAM_EDIYOR")?.tone, .warning)
        XCTAssertEqual(KBStatus.gorev("IPTAL_EDILDI")?.text, "İptal")
        XCTAssertEqual(KBStatus.kontrolFormu("ONAY_BEKLIYOR")?.text, "Onay Bekliyor")
        XCTAssertEqual(KBStatus.kontrolFormu("REDDEDILDI")?.tone, .danger)
    }

    func testPersonelVeWhatsAppDurumlari() {
        XCTAssertEqual(KBStatus.personel("IZINLI")?.text, "İzinli")
        XCTAssertEqual(KBStatus.personel("AYRILDI")?.tone, .neutral)
        XCTAssertEqual(KBStatus.whatsappOnay("OTOMATIK")?.tone, .info)
    }

    func testDenetimIslemleriTurkcelesir() {
        XCTAssertEqual(KBStatus.denetimIslem("GIRIS_BASARISIZ")?.text, "Başarısız Giriş")
        XCTAssertEqual(KBStatus.denetimIslem("GOREV_KAPAT")?.tone, .success)
    }

    func testBosVeBilinmeyenKodlar() {
        XCTAssertNil(KBStatus.envanter(nil))
        XCTAssertNil(KBStatus.envanter("   "))
        XCTAssertEqual(KBStatus.envanter("YENI_DURUM")?.text, "Yeni Durum")
        XCTAssertEqual(KBStatus.envanter("YENI_DURUM")?.tone, .neutral)
    }

    func testKucukHarfliKodlarDaEslesir() {
        XCTAssertEqual(KBStatus.gorev("tamamlandi")?.text, "Tamamlandı")
    }

    // Eşikler web'deki stokDurumu ile aynı: kritik ve %30 tampon.
    func testStokSeviyeEsikleri() {
        XCTAssertEqual(KBStatus.stok(miktar: 10, kritik: 10)?.text, "Kritik")
        XCTAssertEqual(KBStatus.stok(miktar: 9, kritik: 10)?.tone, .danger)
        XCTAssertEqual(KBStatus.stok(miktar: 13, kritik: 10)?.text, "Dikkat")
        XCTAssertEqual(KBStatus.stok(miktar: 13.01, kritik: 10)?.text, "Normal")
        XCTAssertEqual(KBStatus.stok(miktar: 100, kritik: 10)?.tone, .success)
    }

    func testStokKritikEsigiYoksaRozetUretilmez() {
        XCTAssertNil(KBStatus.stok(miktar: 10, kritik: nil))
        XCTAssertNil(KBStatus.stok(miktar: nil, kritik: 10))
        XCTAssertNil(KBStatus.stok(miktar: 10, kritik: 0))
    }

    func testKanalEtiketleri() {
        XCTAssertEqual(KBStatus.kanal("WHATSAPP"), "WhatsApp")
        XCTAssertNil(KBStatus.kanal(nil))
    }

    func testMesaiSaatiHesabi() {
        XCTAssertEqual(MesaiHesap.saat(baslangic: "08:00", bitis: "17:00"), 9, accuracy: 0.001)
        XCTAssertEqual(MesaiHesap.saat(baslangic: "08:30", bitis: "09:00"), 0.5, accuracy: 0.001)
        XCTAssertEqual(MesaiHesap.saat(baslangic: "17:00", bitis: "08:00"), 0)
        XCTAssertEqual(MesaiHesap.saat(baslangic: nil, bitis: "17:00"), 0)
    }
}
