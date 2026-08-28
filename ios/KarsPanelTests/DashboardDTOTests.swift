import XCTest
@testable import KarsPanel

final class DashboardDTOTests: XCTestCase {
    func testLegacyPayloadStillDecodes() throws {
        let json = """
        {
          "acikSikayetler": 4,
          "devamEdenSikayetler": 2,
          "kapaliSikayetler": 9,
          "bekleyenWhatsApp": 1,
          "aktifGorevler": 3,
          "bakimGereken": 1,
          "sikayetKonumlari": []
        }
        """.data(using: .utf8)!
        let dto = try JSONDecoder().decode(DashboardDTO.self, from: json)
        XCTAssertFalse(dto.hasAnalytics)
        XCTAssertEqual(dto.acikSikayetler, 4)
        XCTAssertEqual(dto.bakimGereken, 1)
        XCTAssertEqual(dto.sikayetKonumlari, [])
        XCTAssertEqual(dto.displayAnlik.acikSikayet, 4)
        XCTAssertEqual(dto.displayAnlik.yaklasanMuayene, 1)
        XCTAssertEqual(dto.displayKpi.yeniSikayet.current, 4)
    }

    func testRichPayloadDecodesKpiTrendAndEmptyMap() throws {
        let json = """
        {
          "kpi": {
            "yeniSikayet": { "current": 3, "previous": 5, "changePct": -40 },
            "kapatilanSikayet": { "current": 3, "previous": 0, "changePct": null },
            "ortKapanisGun": { "current": 7, "previous": 7, "changePct": 0 },
            "tamamlananGorev": { "current": 1, "previous": 0, "changePct": null },
            "operasyonMaliyeti": { "current": 0, "previous": 0, "changePct": null }
          },
          "anlik": {
            "acikSikayet": 2,
            "devamEdenSikayet": 1,
            "cokAcil": 0,
            "acil": 1,
            "acilSikayet": 1,
            "onayBekleyenWhatsApp": 0,
            "devamGorev": 2,
            "yaklasanMuayene": 1,
            "yaklasanMuayeneKirilim": { "muayene": 1, "sigorta": 0, "bakim": 0 },
            "konumEksikAcik": 0,
            "kritikStokToplam": 0,
            "aracOperasyon": { "MUSAIT": 2, "GOREVDE": 1 },
            "aracEnvanter": { "AKTIF": 8 }
          },
          "trend": [
            { "gun": "2026-08-01", "acilan": 1, "kapanan": 0 },
            { "gun": "2026-08-02", "acilan": 0, "kapanan": 2 }
          ],
          "mudurlukDagilim": [
            { "id": null, "name": "Fen İşleri", "toplam": 3, "acik": 1 }
          ],
          "turDagilim": [{ "name": "Yol", "toplam": 2 }],
          "kanalDagilim": [{ "kanal": "TELEFON", "toplam": 2 }],
          "mahalleDagilim": [{ "name": "Merkez", "toplam": 2 }],
          "saatlikYogunluk": [{ "haftaGunu": 1, "saat": 9, "adet": 2 }],
          "sikayetKonumlari": [[40.6, 43.09], [40.61, 43.1]],
          "sla": { "bucketLt24h": 1, "bucket1to3d": 0, "bucketGt3d": 1 },
          "preset": "30g",
          "acikSikayetler": 2
        }
        """.data(using: .utf8)!
        let dto = try JSONDecoder().decode(DashboardDTO.self, from: json)
        XCTAssertTrue(dto.hasAnalytics)
        XCTAssertEqual(dto.kpi?.yeniSikayet.current, 3)
        XCTAssertNil(dto.kpi?.kapatilanSikayet.changePct)
        XCTAssertEqual(dto.trend?.count, 2)
        XCTAssertEqual(dto.sikayetKonumlari?.count, 2)
        XCTAssertEqual(dto.sikayetKonumlari?.first?.lat ?? 0, 40.6, accuracy: 0.001)
        XCTAssertEqual(dto.anlik?.yaklasanMuayeneKirilim?.muayene, 1)
        XCTAssertEqual(dto.mudurlukDagilim?.first?.id, "Fen İşleri")
    }
}
