import XCTest
@testable import KarsPanel

/// Faz 4'ün veri sözleşmesi: harita katmanları, rota geometrisi, engel
/// multipart yüklemesi ve TKGM parsel sorgusu.
@MainActor
final class Phase4MapTests: XCTestCase {
    private var client: APIClient!

    override func setUp() {
        super.setUp()
        StubURLProtocol.reset()
        client = APIClient(
            session: StubURLProtocol.makeSession(),
            baseURL: URL(string: "https://panel.test")!
        )
    }

    override func tearDown() {
        StubURLProtocol.reset()
        client = nil
        super.tearDown()
    }

    // MARK: - Geometri

    func testUzunlukWebHaversineIleAyniSonucuVerir() {
        // 40.60,43.09 → 40.61,43.09 ≈ 1111 m (1 enlem dakikası ≈ 1852 m/60)
        let uzunluk = KBGeo.uzunlukMetre([
            KBCoordinate(lat: 40.60, lng: 43.09),
            KBCoordinate(lat: 40.61, lng: 43.09),
        ])
        XCTAssertEqual(uzunluk, 1111, accuracy: 5)
    }

    func testTekNoktaliRotaninUzunluguSifir() {
        XCTAssertEqual(KBGeo.uzunlukMetre([KBCoordinate(lat: 40.6, lng: 43.1)]), 0)
        XCTAssertEqual(KBGeo.uzunlukMetni(0), "—")
    }

    func testUzunlukMetniBirKilometredeBirimDegistirir() {
        XCTAssertEqual(KBGeo.uzunlukMetni(940), "940 m")
        XCTAssertTrue(KBGeo.uzunlukMetni(1500).hasSuffix("km"))
    }

    func testBozukKoordinatCiftleriAtlanir() {
        let coords = KBGeo.coordinates([[40.6, 43.1], [43.1], [40.7, 43.2]])
        XCTAssertEqual(coords.count, 2)
        XCTAssertEqual(KBGeo.pairs(coords), [[40.6, 43.1], [40.7, 43.2]])
    }

    func testGeoJSONSirasiCevrilir() {
        // GeoJSON [lng, lat] → sunucu/uygulama [lat, lng]
        let coords = KBGeo.fromGeoJSON([[43.09, 40.60]])
        XCTAssertEqual(coords.first?.lat, 40.60)
        XCTAssertEqual(coords.first?.lng, 43.09)
    }

    // MARK: - Harita katmanları

    func testKatmanYanitiCozumlenir() async throws {
        StubURLProtocol.stub = .json("""
        {
          "duzenleyebilir": true,
          "personelAtayabilir": true,
          "yollar": [{
            "id":"y1","ad":"Ordu Caddesi","koordinatlar":[[40.6,43.09],[40.61,43.10]],
            "durum":"TAMAMLANDI","dokumTarihi":"2026-06-01T00:00:00Z","notlar":null,
            "olusturan":"Ali","createdAt":"2026-06-01T08:00:00Z","departmentId":"d1",
            "mudurluk":"Fen İşleri",
            "personel":[{"id":"p1","adSoyad":"Veli Demir","unvan":"Operatör"}]
          }],
          "engeller": [{
            "id":"e1","tip":"CUKUR","lat":40.6,"lng":43.09,"aciklama":"Derin çukur",
            "durum":"ACIK","olusturan":"Ali","tarih":"2026-07-01T10:00:00Z",
            "photoIds":["f1","f2"]
          }],
          "sikayetler": [{
            "id":"s1","sikayetNo":"2026-001","durum":"Açık","durumKodu":"ACIK",
            "lat":40.6,"lng":43.09,"aciklama":null
          }],
          "araclar": [{
            "id":"a1","plaka":"36 AB 001","tip":"Greyder","lat":40.6,"lng":43.09,
            "zaman":"2026-07-31T09:00:00Z"
          }],
          "mudurlukler": [{"id":"d1","name":"Fen İşleri"}],
          "atanabilirPersonel": [{"id":"p1","adSoyad":"Veli Demir","unvan":"Operatör"}]
        }
        """)

        let katmanlar = try await client.fetchMapLayers()

        XCTAssertEqual(
            StubURLProtocol.lastRequest?.url?.path,
            "/api/v1/harita/katmanlar"
        )
        XCTAssertEqual(katmanlar.yollar.first?.durumu, .TAMAMLANDI)
        XCTAssertEqual(katmanlar.yollar.first?.personelAdlari, "Veli Demir")
        XCTAssertEqual(katmanlar.engeller.first?.tipi, .CUKUR)
        XCTAssertEqual(katmanlar.engeller.first?.durumu, .ACIK)
        XCTAssertEqual(katmanlar.engeller.first?.photoIds.count, 2)
        XCTAssertEqual(katmanlar.araclar.first?.plaka, "36 AB 001")
    }

    // MARK: - Asfalt yol

    func testYolGuncellemeSadeceGonderilenAlanlariIcerir() async throws {
        StubURLProtocol.stub = .json("""
        {"id":"y1","ad":"Yeni Ad","koordinatlar":[[40.6,43.09],[40.61,43.10]],
         "durum":"DEVAM","dokumTarihi":null,"notlar":null,"olusturan":null,
         "createdAt":null,"departmentId":null,"mudurluk":null,"personel":[]}
        """)

        _ = try await client.updateAsphaltRoad(
            id: "y1",
            body: AsphaltRoadPatchDTO(ad: "Yeni Ad", notlar: .some(nil))
        )

        let gonderilen = try XCTUnwrap(
            try JSONSerialization.jsonObject(
                with: XCTUnwrap(StubURLProtocol.lastBody)
            ) as? [String: Any]
        )
        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "PATCH")
        XCTAssertEqual(gonderilen["ad"] as? String, "Yeni Ad")
        // İç nil = alanı temizle; dış nil = alan hiç gönderilmez.
        XCTAssertTrue(gonderilen["notlar"] is NSNull)
        XCTAssertNil(gonderilen["departmentId"])
        XCTAssertNil(gonderilen["durum"])
    }

    func testEngelKaydiMultipartOlarakGonderilir() async throws {
        StubURLProtocol.stub = .json("""
        {"id":"e1","tip":"CUKUR","lat":40.6,"lng":43.09,"aciklama":"Derin",
         "durum":"ACIK","photoIds":["f1"]}
        """)

        _ = try await client.createHazard(
            lat: 40.6,
            lng: 43.09,
            tip: .CUKUR,
            aciklama: "Derin",
            photos: [.jpeg(Data([0xFF, 0xD8, 0xFF]), index: 0)]
        )

        let contentType = StubURLProtocol.lastRequest?
            .value(forHTTPHeaderField: "Content-Type") ?? ""
        let body = String(decoding: try XCTUnwrap(StubURLProtocol.lastBody), as: UTF8.self)

        XCTAssertTrue(contentType.hasPrefix("multipart/form-data; boundary="))
        XCTAssertTrue(body.contains("name=\"tip\""))
        XCTAssertTrue(body.contains("CUKUR"))
        XCTAssertTrue(body.contains("name=\"photos\"; filename=\"engel-1.jpg\""))
        XCTAssertTrue(body.contains("Content-Type: image/jpeg"))
    }

    // MARK: - Operasyon rotaları

    func testKisRotaListesiVeOncelikEtiketi() async throws {
        StubURLProtocol.stub = .json("""
        {"duzenleyebilir":true,
         "rotalar":[{"id":"r1","ad":"Kale Yolu","koordinatlar":[[40.6,43.09],[40.62,43.11]],
           "tip":"TUZLAMA","oncelik":1,"aktif":true,"notlar":null,
           "sonOperasyon":"2026-07-30T06:00:00Z","sonOperasyonlar":[
             {"id":"o1","routeId":"r1","tip":"TUZLAMA","vehicleId":"a1","driverId":null,
              "baslangic":"2026-07-30T06:00:00Z","bitis":null,"tuzKg":250,"notlar":null,
              "plaka":"36 AB 001","soforAdi":null}]}],
         "malzemeler":[{"id":"m1","kod":"TZ","ad":"Yol Tuzu","birim":"kg",
           "kategori":"KIS","stok":12000}]}
        """)

        let veri = try await client.fetchWinterOverview()
        let rota = try XCTUnwrap(veri.rotalar.first)

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/kis/rotalar")
        XCTAssertEqual(rota.tipi, .TUZLAMA)
        XCTAssertEqual(rota.oncelikEtiketi, "1 · Yüksek")
        XCTAssertEqual(rota.sonOperasyonlar.first?.tuzKg, 250)
        XCTAssertEqual(veri.malzemeler.first?.stok, 12000)
    }

    func testCopRotasiGunEtiketiVeBugunFiltresi() async throws {
        StubURLProtocol.stub = .json("""
        {"duzenleyebilir":false,
         "rotalar":[{"id":"r1","ad":"Merkez","koordinatlar":[[40.6,43.09],[40.61,43.10]],
           "gunler":[1,3,5],"oncelik":2,"aktif":true,"notlar":null,
           "sonToplama":null,"sonToplamalar":[]}]}
        """)

        let veri = try await client.fetchWasteOverview()
        let rota = try XCTUnwrap(veri.rotalar.first)

        XCTAssertEqual(rota.gunEtiketi, "Paz, Çar, Cum")
        XCTAssertFalse(veri.duzenleyebilir)
    }

    func testIsoGunPazariYediSayar() throws {
        var bilesenler = DateComponents()
        bilesenler.year = 2026
        bilesenler.month = 8
        bilesenler.day = 2 // Pazar
        let takvim = Calendar(identifier: .gregorian)

        XCTAssertEqual(WeekDay.isoGun(try XCTUnwrap(takvim.date(from: bilesenler))), 7)

        bilesenler.day = 3 // Pazartesi
        XCTAssertEqual(WeekDay.isoGun(try XCTUnwrap(takvim.date(from: bilesenler))), 1)
    }

    func testTemizlikRotasiOlusturmaGovdesi() async throws {
        StubURLProtocol.stub = .json("""
        {"id":"t1","ad":"Cumhuriyet Cad.","koordinatlar":[[40.6,43.09],[40.61,43.10]],
         "oncelik":3,"aktif":true,"notlar":null,"sonGorev":null}
        """)

        _ = try await client.createCleaningRoute(
            CleaningRouteRequestDTO(
                ad: "Cumhuriyet Cad.",
                koordinatlar: [[40.6, 43.09], [40.61, 43.10]],
                oncelik: RoutePriority.dusuk.rawValue,
                notlar: nil
            )
        )

        let gonderilen = try XCTUnwrap(
            try JSONSerialization.jsonObject(
                with: XCTUnwrap(StubURLProtocol.lastBody)
            ) as? [String: Any]
        )
        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/temizlik/rotalar")
        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "POST")
        XCTAssertEqual(gonderilen["oncelik"] as? Int, 3)
        XCTAssertEqual((gonderilen["koordinatlar"] as? [[Double]])?.count, 2)
    }

    func testRotaFormuEnAzIkiNoktaIster() {
        let tekNokta = RouteFormValidation.hatalar(
            ad: "Rota",
            noktalar: [KBCoordinate(lat: 40.6, lng: 43.09)]
        )
        XCTAssertNotNil(tekNokta["koordinatlar"])
        XCTAssertNil(tekNokta["ad"])

        let adsiz = RouteFormValidation.hatalar(
            ad: "   ",
            noktalar: [KBCoordinate(lat: 40.6, lng: 43.09), KBCoordinate(lat: 40.7, lng: 43.1)]
        )
        XCTAssertNotNil(adsiz["ad"])
        XCTAssertNil(adsiz["koordinatlar"])
    }

    // MARK: - Parsel

    func testParselSorgusuVeMultiPolygonGeometrisi() async throws {
        StubURLProtocol.stub = .json("""
        {"id":"pa1","ilAd":"Kars","ilceAd":"Merkez","mahalleAd":"Yenişehir",
         "mahalleId":1234,"adaNo":"120","parselNo":"7","alan":842.5,
         "nitelik":"Arsa","mevkii":null,"pafta":null,
         "geometri":{"type":"MultiPolygon","coordinates":[
            [[[43.09,40.60],[43.10,40.60],[43.10,40.61],[43.09,40.60]]],
            [[[43.11,40.62],[43.12,40.62],[43.12,40.63],[43.11,40.62]]]]},
         "lat":40.605,"lng":43.095,"kaynak":"tkgm",
         "sorgulandi":"2026-07-31T09:00:00Z"}
        """)

        let parsel = try await client.fetchParcel(
            mahalleId: 1234,
            ada: "120",
            parsel: "7",
            yenile: true
        )
        let sorgu = try XCTUnwrap(
            URLComponents(
                url: try XCTUnwrap(StubURLProtocol.lastRequest?.url),
                resolvingAgainstBaseURL: false
            )?.queryItems
        )

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/ops/parsel")
        XCTAssertTrue(sorgu.contains(URLQueryItem(name: "refresh", value: "1")))
        XCTAssertEqual(parsel.baslik, "120 ada / 7 parsel")
        XCTAssertEqual(parsel.konum, "Merkez · Yenişehir")
        XCTAssertTrue(parsel.tazeMi)
        // MultiPolygon halkaları tek listeye indirgenir
        XCTAssertEqual(parsel.geometri.halkalar.count, 2)
        XCTAssertEqual(KBGeo.fromGeoJSON(parsel.geometri.disHalka).count, 4)
    }

    func testBosAdaSifirOlarakGonderilir() async throws {
        StubURLProtocol.stub = .json("""
        {"id":"pa1","ilAd":"Kars","ilceAd":"Merkez","mahalleAd":"Yenişehir",
         "mahalleId":1234,"adaNo":"0","parselNo":"7","alan":null,"nitelik":null,
         "mevkii":null,"pafta":null,
         "geometri":{"type":"Polygon","coordinates":[
            [[43.09,40.60],[43.10,40.60],[43.10,40.61],[43.09,40.60]]]},
         "lat":40.605,"lng":43.095,"kaynak":"cache","sorgulandi":"2026-07-31T09:00:00Z"}
        """)

        let parsel = try await client.fetchParcel(mahalleId: 1234, ada: "", parsel: "7")
        let sorgu = try XCTUnwrap(
            URLComponents(
                url: try XCTUnwrap(StubURLProtocol.lastRequest?.url),
                resolvingAgainstBaseURL: false
            )?.queryItems
        )

        XCTAssertTrue(sorgu.contains(URLQueryItem(name: "ada", value: "0")))
        XCTAssertFalse(sorgu.contains(where: { $0.name == "refresh" }))
        XCTAssertFalse(parsel.tazeMi)
        XCTAssertEqual(parsel.geometri.halkalar.count, 1)
    }

    func testIlceListesiSarmalayicidanCikarilir() async throws {
        StubURLProtocol.stub = .json("""
        {"items":[{"id":1,"ad":"Merkez"},{"id":2,"ad":"Sarıkamış"}]}
        """)

        let ilceler = try await client.fetchParcelDistricts()

        XCTAssertEqual(ilceler.map(\.ad), ["Merkez", "Sarıkamış"])
        XCTAssertEqual(
            URLComponents(
                url: try XCTUnwrap(StubURLProtocol.lastRequest?.url),
                resolvingAgainstBaseURL: false
            )?.queryItems,
            [URLQueryItem(name: "liste", value: "ilce")]
        )
    }
}
