import XCTest
@testable import KarsPanel

final class DashboardChartDataTests: XCTestCase {
    // MARK: - Trend

    func testTrendParsesDaysAndSortsChronologically() {
        let points = DashboardChartData.trend(from: [
            DashboardTrendPointDTO(gun: "2026-08-03", acilan: 5, kapanan: 1),
            DashboardTrendPointDTO(gun: "2026-08-01", acilan: 2, kapanan: 4),
            DashboardTrendPointDTO(gun: "gecersiz", acilan: 9, kapanan: 9),
        ])

        XCTAssertEqual(points.count, 2, "Ayrıştırılamayan gün atılmalı")
        XCTAssertEqual(points.first?.acilan, 2)
        XCTAssertTrue(points[0].date < points[1].date)
    }

    func testAverageOpenedMatchesArithmeticMean() {
        let points = DashboardChartData.trend(from: [
            DashboardTrendPointDTO(gun: "2026-08-01", acilan: 2, kapanan: 0),
            DashboardTrendPointDTO(gun: "2026-08-02", acilan: 4, kapanan: 0),
            DashboardTrendPointDTO(gun: "2026-08-03", acilan: 3, kapanan: 0),
        ])

        XCTAssertEqual(DashboardChartData.ortalamaAcilan(points), 3, accuracy: 0.001)
        XCTAssertEqual(DashboardChartData.ortalamaAcilan([]), 0)
    }

    func testTrendEmptyDetectsAllZeroSeries() {
        let sifir = DashboardChartData.trend(from: [
            DashboardTrendPointDTO(gun: "2026-08-01", acilan: 0, kapanan: 0),
        ])
        XCTAssertTrue(DashboardChartData.trendBos(sifir))

        let dolu = DashboardChartData.trend(from: [
            DashboardTrendPointDTO(gun: "2026-08-01", acilan: 0, kapanan: 1),
        ])
        XCTAssertFalse(DashboardChartData.trendBos(dolu))
    }

    // MARK: - Müdürlük

    func testDepartmentsLimitToEightAndSkipZeroSegments() {
        let dto = (1...12).map { index in
            DashboardMudurlukDTO(
                departmentId: "d\(index)",
                name: "Müdürlük \(index)",
                toplam: 10,
                acik: 6,
                devam: 0,
                kapatildi: 4,
                cokAcil: nil,
                acil: nil
            )
        }

        let bars = DashboardChartData.departments(from: dto)
        XCTAssertEqual(bars.count, 8)
        XCTAssertEqual(bars.first?.toplam, 10)

        let segments = DashboardChartData.departmentSegments(bars)
        XCTAssertEqual(segments.count, 16, "Sıfır olan 'devam' segmenti çizilmemeli")
        XCTAssertFalse(segments.contains { $0.value == 0 })
    }

    func testDepartmentFallsBackToTotalWhenBreakdownMissing() {
        let bars = DashboardChartData.departments(from: [
            DashboardMudurlukDTO(
                departmentId: nil,
                name: "Fen İşleri",
                toplam: 7,
                acik: nil,
                devam: nil,
                kapatildi: nil,
                cokAcil: nil,
                acil: nil
            )
        ])

        XCTAssertEqual(bars.first?.acik, 7, "Kırılım yoksa toplam açık kovasına düşer")
        XCTAssertEqual(bars.first?.toplam, 7)
    }

    // MARK: - Dilimler

    func testTopSlicesGroupsRemainderIntoOther() {
        let slices = (1...10).map { ChartSlice(name: "T\($0)", value: 11 - $0) }
        let sonuc = DashboardChartData.topSlices(slices, limit: 7)

        XCTAssertEqual(sonuc.count, 8)
        XCTAssertEqual(sonuc.last?.name, "Diğer")
        XCTAssertEqual(sonuc.last?.value, 3 + 2 + 1)
    }

    func testTopSlicesKeepsListWhenUnderLimit() {
        let slices = [ChartSlice(name: "A", value: 3), ChartSlice(name: "B", value: 1)]
        XCTAssertEqual(DashboardChartData.topSlices(slices, limit: 7), slices)
    }

    func testTopSlicesDropsZeroValues() {
        let slices = [ChartSlice(name: "A", value: 3), ChartSlice(name: "B", value: 0)]
        XCTAssertEqual(DashboardChartData.topSlices(slices, limit: 7).map(\.name), ["A"])
    }

    func testTopSlicesMergesRemainderIntoExistingOtherCategory() {
        // Şikayet türleri arasında zaten "Diğer" var; ikinci bir "Diğer" satırı çıkmamalı.
        let slices = [
            ChartSlice(name: "Yol", value: 30),
            ChartSlice(name: "Diğer", value: 13),
            ChartSlice(name: "Park", value: 4),
            ChartSlice(name: "Su", value: 2),
        ]

        let sonuc = DashboardChartData.topSlices(slices, limit: 2)
        XCTAssertEqual(sonuc.map(\.name), ["Yol", "Diğer"])
        XCTAssertEqual(sonuc.last?.value, 13 + 4 + 2)
    }

    // MARK: - Kısaltmalar

    func testNameSuffixesAreTrimmedForNarrowRows() {
        XCTAssertEqual(DashboardChartData.kisaMudurluk("Fen İşleri Müdürlüğü"), "Fen İşleri")
        XCTAssertEqual(DashboardChartData.kisaMahalle("Atatürk Mahallesi"), "Atatürk")
    }

    func testNameSuffixTrimKeepsNamesWithoutSuffix() {
        XCTAssertEqual(DashboardChartData.kisaMudurluk("Diğer"), "Diğer")
        XCTAssertEqual(DashboardChartData.kisaMahalle("Yenimahalle"), "Yenimahalle")
        XCTAssertEqual(DashboardChartData.kisaMahalle("Mahallesi"), "Mahallesi")
    }

    func testVehicleSlicesKeepFixedOrderAndDropEmptyStates() {
        let slices = DashboardChartData.vehicles(from: [
            "ARIZALI": 1,
            "MUSAIT": 5,
            "GOREVDE": 3,
            "BAKIMDA": 0,
        ])

        XCTAssertEqual(slices.map(\.name), ["Müsait", "Görevde", "Arızalı"])
        XCTAssertEqual(DashboardChartData.vehicleKey(forLabel: "Planlı bakım"), "PLANLI_BAKIM")
    }

    func testChannelsUseTurkishLabels() {
        let slices = DashboardChartData.channels(from: [
            DashboardKanalDTO(kanal: "TELEFON", toplam: 4),
            DashboardKanalDTO(kanal: "WHATSAPP", toplam: 2),
            DashboardKanalDTO(kanal: "WEB", toplam: 0),
        ])

        XCTAssertEqual(slices.map(\.name), ["Telefon", "WhatsApp"])
    }

    func testSliceIndexResolvesCumulativeAngleValue() {
        let slices = [
            ChartSlice(name: "A", value: 10),
            ChartSlice(name: "B", value: 5),
            ChartSlice(name: "C", value: 5),
        ]

        XCTAssertEqual(DashboardChartData.sliceIndex(forAngleValue: 0, in: slices), 0)
        XCTAssertEqual(DashboardChartData.sliceIndex(forAngleValue: 9, in: slices), 0)
        XCTAssertEqual(DashboardChartData.sliceIndex(forAngleValue: 10, in: slices), 1)
        XCTAssertEqual(DashboardChartData.sliceIndex(forAngleValue: 17, in: slices), 2)
        XCTAssertNil(DashboardChartData.sliceIndex(forAngleValue: 20, in: slices))
        XCTAssertNil(DashboardChartData.sliceIndex(forAngleValue: nil, in: slices))
    }

    // MARK: - Isı matrisi

    func testHeatMatrixFillsFullWeekAndMergesDuplicates() {
        let matris = DashboardChartData.heatMatrix(from: [
            DashboardSaatlikDTO(haftaGunu: 1, saat: 9, adet: 2),
            DashboardSaatlikDTO(haftaGunu: 1, saat: 9, adet: 3),
            DashboardSaatlikDTO(haftaGunu: 9, saat: 9, adet: 99),
        ])

        XCTAssertEqual(matris.count, 7 * 24, "Boş hücreler de matriste yer almalı")
        XCTAssertEqual(matris.first { $0.haftaGunu == 1 && $0.saat == 9 }?.adet, 5)
        XCTAssertEqual(DashboardChartData.heatMax(matris), 5)
        XCTAssertFalse(matris.contains { $0.haftaGunu == 9 }, "Aralık dışı gün atılmalı")
    }

    func testHeatMaxNeverReturnsZero() {
        let bos = DashboardChartData.heatMatrix(from: [])
        XCTAssertEqual(DashboardChartData.heatMax(bos), 1, "Sıfıra bölmeyi önlemeli")
    }

    func testDayAndHourLabels() {
        XCTAssertEqual(DashboardChartData.gunEtiketi(1), "Pzt")
        XCTAssertEqual(DashboardChartData.gunEtiketi(7), "Paz")
        XCTAssertEqual(DashboardChartData.gunEtiketi(0), "?")
        XCTAssertEqual(DashboardChartData.saatEtiketi(7), "07")
        XCTAssertEqual(DashboardChartData.saatEtiketi(21), "21")
    }

    // MARK: - Maliyet

    func testCostPointsCarryTotalAndReadableLabel() {
        let points = DashboardChartData.cost(from: [
            DashboardMaliyetPointDTO(ay: "2026-07", bakim: 1200, yakit: 800)
        ])

        XCTAssertEqual(points.first?.toplam, 2000)
        XCTAssertNotEqual(points.first?.label, "2026-07", "Ay anahtarı okunur etikete çevrilmeli")
    }

    // MARK: - SLA

    func testSlaSegmentsKeepBucketOrder() {
        let segments = DashboardChartData.slaSegments(
            from: DashboardSlaDTO(bucketLt24h: 3, bucket1to3d: 2, bucketGt3d: 9)
        )

        XCTAssertEqual(segments.map(\.value), [3, 2, 9])
        XCTAssertEqual(segments.first?.name, "24 saatten az")
    }

    // MARK: - Biçimlendirme

    func testPercentageIsSafeAgainstZeroTotal() {
        XCTAssertEqual(KBChartFormat.yuzde(5, of: 20), 25)
        XCTAssertEqual(KBChartFormat.yuzde(5, of: 0), 0)
    }

    func testAxisMoneyFormatterAbbreviatesThousands() {
        XCTAssertEqual(KBChartFormat.tlEksen(950), "950")
        XCTAssertEqual(KBChartFormat.tlEksen(12_400), "12b")
        XCTAssertEqual(KBChartFormat.tlEksen(2_100_000), "2m")
    }

    func testDayKeyParsing() {
        XCTAssertNotNil(KBChartFormat.gunTarihi("2026-08-01"))
        XCTAssertNil(KBChartFormat.gunTarihi("01.08.2026"))
        XCTAssertNotNil(KBChartFormat.ayTarihi("2026-08"))
    }

    func testHeatRampStaysWithinBounds() {
        let (r, g, b) = KBChart.isiBilesenleri(1.8)
        XCTAssertTrue((0...1).contains(r) && (0...1).contains(g) && (0...1).contains(b))

        let (r0, _, _) = KBChart.isiBilesenleri(-1)
        XCTAssertEqual(r0, 0xee / 255.0, accuracy: 0.001, "Alt sınır rampanın açık ucu olmalı")
    }
}
