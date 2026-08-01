import XCTest
@testable import KarsPanel

/// Faz 5'in çekirdeği: komuta veri sözleşmesi, sevkiyat skorları, bildirim
/// derin bağlantıları ve polling politikası.
@MainActor
final class Phase5KomutaTests: XCTestCase {
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

    // MARK: - Komuta verisi

    func testKomutaYanitiCozumlenir() async throws {
        StubURLProtocol.stub = .json(Self.komutaJSON)

        let veri = try await client.fetchKomuta()

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/komuta")
        XCTAssertEqual(veri.kpi.acikSikayet, 12)
        XCTAssertEqual(veri.kpi.tazeKonumluArac, 2)
        XCTAssertEqual(veri.araclar.count, 3)
        XCTAssertEqual(veri.sikayetler.first?.bucket, .gt3)
        XCTAssertEqual(veri.bekleyenler.first?.tip, .COP)
        XCTAssertEqual(veri.gecikenRotalar.first?.tip, .KIS)
    }

    func testRotaDurumuSapmaMesafesiniGosterir() async throws {
        StubURLProtocol.stub = .json(Self.komutaJSON)
        let veri = try await client.fetchKomuta()

        XCTAssertEqual(veri.araclar[0].rotaDurumu, "rotada")
        XCTAssertEqual(veri.araclar[1].rotaDurumu, "rota dışı (320 m)")
        // Ölçülemeyen araç için rozet hiç gösterilmez
        XCTAssertNil(veri.araclar[2].rotaDurumu)
    }

    func testFiloOzetiFiloyuTamOlarakBoler() async throws {
        StubURLProtocol.stub = .json(Self.komutaJSON)
        let veri = try await client.fetchKomuta()
        let filo = KomutaFiloOzeti(araclar: veri.araclar)

        // a1 görevde, a2 boşta+konumlu, a3 boşta+konumsuz
        XCTAssertEqual(filo.gorevde, 1)
        XCTAssertEqual(filo.bosta, 1)
        XCTAssertEqual(filo.konumsuz, 1)
        XCTAssertEqual(filo.gorevde + filo.bosta + filo.konumsuz, veri.araclar.count)
    }

    func testGorevdekiAracKonumsuzOlsaDaGorevdeSayilir() {
        let filo = KomutaFiloOzeti(araclar: [Self.arac(id: "a", gorevde: true, konumlu: false)])
        XCTAssertEqual(filo.gorevde, 1)
        XCTAssertEqual(filo.konumsuz, 0)
    }

    func testSlaKovalariGecikmeyiAyirir() {
        XCTAssertFalse(KomutaSlaBucket.lt24.gecikmis)
        XCTAssertTrue(KomutaSlaBucket.d1to3.gecikmis)
        XCTAssertTrue(KomutaSlaBucket.gt3.gecikmis)
        XCTAssertEqual(KomutaSlaBucket.gt3.badgeTone, .danger)
    }

    func testGecikenRotaMetniTipeGoreDegisir() async throws {
        StubURLProtocol.stub = .json(Self.komutaJSON)
        let veri = try await client.fetchKomuta()
        let rota = try XCTUnwrap(veri.gecikenRotalar.first)

        XCTAssertEqual(rota.gecikmeMetni, "Öncelik-1 — 12 saattir işlem yok")
        // Aynı rota kimliği farklı tiplerde tekrar edebildiği için liste kimliği
        // tip önekli olmalı.
        XCTAssertEqual(rota.listeId, "KIS:r1")
    }

    func testBekleyenOneriMetniTahminiIsaretler() async throws {
        StubURLProtocol.stub = .json(Self.komutaJSON)
        let veri = try await client.fetchKomuta()
        let oneri = try XCTUnwrap(veri.bekleyenler.first)

        XCTAssertTrue(oneri.aracMetni.contains("36 AB 002"))
        XCTAssertTrue(oneri.aracMetni.contains("kuş uçuşu"))
        XCTAssertEqual(oneri.id, oneri.jobId)
    }

    // MARK: - Sevkiyat

    func testAdaylarSorgusuTipVeRotaGonderir() async throws {
        StubURLProtocol.stub = .json("""
        {"tip":"KIS","routeId":"r1","routeAd":"Kale Yolu","adaylar":[
          {"vehicleId":"a1","plaka":"36 AB 001","tip":"Greyder","sureDk":8.4,
           "mesafeKm":3.2,"tahmini":false,"skor":83,
           "kirilim":{"sure":40,"tip":20,"tazelik":10,"yuk":8,"yakit":5},
           "etiketler":["uygun tip"],"bayat":false}]}
        """)

        let veri = try await client.fetchDispatchCandidates(tip: .KIS, routeId: "r1")
        let sorgu = try XCTUnwrap(
            URLComponents(
                url: try XCTUnwrap(StubURLProtocol.lastRequest?.url),
                resolvingAgainstBaseURL: false
            )?.queryItems
        )

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/dispatch/adaylar")
        XCTAssertTrue(sorgu.contains(URLQueryItem(name: "tip", value: "KIS")))
        XCTAssertTrue(sorgu.contains(URLQueryItem(name: "routeId", value: "r1")))
        XCTAssertEqual(veri.adaylar.first?.skor, 83)
        XCTAssertEqual(
            veri.adaylar.first?.kirilim.ozet,
            "süre 40 · tip 20 · konum 10 · yük 8 · yakıt 5"
        )
    }

    func testTahminiSureKusUcusuNotuDusurur() throws {
        let aday = try Self.decode(
            DispatchAdayDTO.self,
            """
            {"vehicleId":"a1","plaka":"36 AB 001","tip":null,"sureDk":12,
             "mesafeKm":5,"tahmini":true,"skor":60,
             "kirilim":{"sure":30,"tip":0,"tazelik":10,"yuk":10,"yakit":10},
             "etiketler":[],"bayat":true}
            """
        )
        XCTAssertTrue(aday.mesafeMetni.contains("kuş uçuşu"))
    }

    func testUygunAracYoksaOneriBossaNilDoner() async throws {
        StubURLProtocol.stub = .json("null")
        let oneri = try await client.suggestDispatch(tip: .TEMIZLIK, routeId: "r9")

        XCTAssertNil(oneri)
        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "POST")
        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/dispatch/oner")
    }

    func testAracAtamaGovdesiUcAlaniIcerir() async throws {
        StubURLProtocol.stub = .json("""
        {"gorevNo":"2026-0042","taskId":"t1","jobId":"j1"}
        """)

        let sonuc = try await client.assignVehicleToRoute(
            tip: .COP,
            routeId: "r2",
            vehicleId: "a1"
        )
        let govde = try XCTUnwrap(
            try JSONSerialization.jsonObject(
                with: XCTUnwrap(StubURLProtocol.lastBody)
            ) as? [String: Any]
        )

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/dispatch/arac-ata")
        XCTAssertEqual(govde["tip"] as? String, "COP")
        XCTAssertEqual(govde["routeId"] as? String, "r2")
        XCTAssertEqual(govde["vehicleId"] as? String, "a1")
        XCTAssertEqual(sonuc.gorevNo, "2026-0042")
    }

    func testOneriOnayVeRedAyniGovdeyiKullanir() async throws {
        StubURLProtocol.stub = .json("""
        {"gorevNo":"2026-0043","taskId":"t2","jobId":"j2"}
        """)
        _ = try await client.acceptDispatch(jobId: "j2")
        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/dispatch/ata")

        StubURLProtocol.stub = .json("{\"jobId\":\"j2\"}")
        _ = try await client.rejectDispatch(jobId: "j2")

        let govde = try XCTUnwrap(
            try JSONSerialization.jsonObject(
                with: XCTUnwrap(StubURLProtocol.lastBody)
            ) as? [String: Any]
        )
        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/dispatch/reddet")
        XCTAssertEqual(govde["jobId"] as? String, "j2")
    }

    // MARK: - SLA taraması

    func testSlaTaramasiZorlaParametresiGonderir() async throws {
        StubURLProtocol.stub = .json("""
        {"calisti":true,"sikayet":2,"gecikenKisRota":1,"gecikenCopRota":0}
        """)

        let sonuc = try await client.runSlaScan()

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/sla/tarama")
        // Sunucu `zorla` için tam olarak "1" bekler ("true" kısıtı atlamaz).
        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.query, "zorla=1")
        XCTAssertTrue(sonuc.ozet.contains("2 şikayet"))
    }

    func testAtlananTaramaOzetiKullaniciyaAciklanir() throws {
        let sonuc = try Self.decode(
            SlaScanResultDTO.self,
            """
            {"calisti":false,"sikayet":0,"gecikenKisRota":0,"gecikenCopRota":0}
            """
        )
        XCTAssertEqual(sonuc.ozet, "Tarama az önce yapılmıştı, atlandı.")
    }

    // MARK: - Bildirimler ve cihaz kaydı

    func testBildirimListesiOkunmamisSayisiylaGelir() async throws {
        StubURLProtocol.stub = .json("""
        {"unread":2,"items":[
          {"id":"b1","tip":"SLA","baslik":"Şikayet gecikti","mesaj":"3 günü aştı",
           "href":"/sikayetler/s1","okundu":false,"createdAt":"2026-07-31T09:00:00Z"},
          {"id":"b2","tip":"ATAMA","baslik":"Yeni görev","mesaj":null,
           "href":"/gorevler/t1/takip","okundu":true,"createdAt":null}]}
        """)

        let liste = try await client.fetchNotifications()

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/notifications")
        XCTAssertEqual(liste.unread, 2)
        XCTAssertEqual(liste.items.first?.hedef?.destination, .sikayetler)
        XCTAssertEqual(liste.items.last?.hedef?.route, .taskTrack("t1"))
    }

    func testBildirimOkunduPatchIleIsaretlenir() async throws {
        StubURLProtocol.stub = .json("{\"unread\":1}")
        let sonuc = try await client.markNotificationRead(id: "b1")

        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "PATCH")
        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/notifications/b1")
        XCTAssertEqual(sonuc.unread, 1)
    }

    func testTumunuOkuAyriUcaGider() async throws {
        StubURLProtocol.stub = .json("{\"unread\":0}")
        _ = try await client.markAllNotificationsRead()

        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "POST")
        XCTAssertEqual(
            StubURLProtocol.lastRequest?.url?.path,
            "/api/v1/notifications/tumunu-oku"
        )
    }

    func testCihazKaydiTokenVePlatformGonderir() async throws {
        StubURLProtocol.stub = .json("""
        {"id":"d1","platform":"APNS_SANDBOX","aktif":true}
        """)

        _ = try await client.registerDevice(
            DeviceRegisterRequestDTO(
                token: "abc123",
                platform: "APNS_SANDBOX",
                uygulama: "KarsPanel 1.0.0",
                cihaz: "iPhone15,2"
            )
        )
        let govde = try XCTUnwrap(
            try JSONSerialization.jsonObject(
                with: XCTUnwrap(StubURLProtocol.lastBody)
            ) as? [String: Any]
        )

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/devices")
        XCTAssertEqual(govde["token"] as? String, "abc123")
        XCTAssertEqual(govde["platform"] as? String, "APNS_SANDBOX")
    }

    func testCihazKaldirmaDeleteIleGider() async throws {
        StubURLProtocol.stub = .json("{}")
        try await client.unregisterDevice(token: "abc123")

        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "DELETE")
        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/devices")
    }

    // MARK: - Derin bağlantı

    func testDerinBaglantiDetayYollariniCozer() throws {
        XCTAssertEqual(KBDeepLink(href: "/sikayetler/s1")?.route, .complaint("s1"))
        XCTAssertEqual(KBDeepLink(href: "/islerim/s1")?.route, .workItemComplaint("s1"))
        XCTAssertEqual(KBDeepLink(href: "/kontrol-listeleri/k1")?.route, .checklist("k1"))
        XCTAssertEqual(KBDeepLink(href: "/gorevler/t1")?.route, .task("t1"))
        XCTAssertEqual(KBDeepLink(href: "/gorevler/t1/takip")?.route, .taskTrack("t1"))
        XCTAssertEqual(KBDeepLink(href: "/araclar/a1")?.route, .vehicle("a1"))
        XCTAssertEqual(KBDeepLink(href: "/personel/p1")?.route, .personnel("p1"))
    }

    func testModulYollariDetaysizCozulur() throws {
        XCTAssertEqual(KBDeepLink(href: "/")?.destination, .dashboard)
        XCTAssertEqual(KBDeepLink(href: "/komuta")?.destination, .komuta)
        XCTAssertEqual(KBDeepLink(href: "/kis")?.destination, .kis)
        XCTAssertNil(KBDeepLink(href: "/kis")?.route)
    }

    func testYeniKaydiFormlariDetayDegilModulAcar() throws {
        // `/sikayetler/yeni` bir kayıt kimliği değil; modül listesine gidilir.
        let baglanti = try XCTUnwrap(KBDeepLink(href: "/sikayetler/yeni"))
        XCTAssertEqual(baglanti.destination, .sikayetler)
        XCTAssertNil(baglanti.route)
    }

    func testSorguVeTamAdresliYollarTemizlenir() throws {
        XCTAssertEqual(
            KBDeepLink(href: "/sikayetler/s1?tab=fotograflar#ust")?.route,
            .complaint("s1")
        )
        XCTAssertEqual(
            KBDeepLink(href: "https://panel.kars.bel.tr/gorevler/t1")?.route,
            .task("t1")
        )
    }

    func testBilinmeyenYolNilDoner() throws {
        XCTAssertNil(KBDeepLink(href: "/olmayan-modul"))
        XCTAssertNil(KBDeepLink(href: "/olmayan-modul/x1"))
    }

    // MARK: - Polling politikası

    func testPollingAraliklariWebIleAyni() {
        XCTAssertEqual(KBPollingChannel.komuta.interval, 30)
        XCTAssertEqual(KBPollingChannel.whatsapp.interval, 15)
        XCTAssertEqual(KBPollingChannel.bildirim.interval, 30)
    }

    func testArkaPlandaVeGizliEkrandaPollingDurur() {
        XCTAssertTrue(KBPollingPolicy.calismali(phase: .active, ekranGorunur: true))
        XCTAssertFalse(KBPollingPolicy.calismali(phase: .background, ekranGorunur: true))
        XCTAssertFalse(KBPollingPolicy.calismali(phase: .inactive, ekranGorunur: true))
        XCTAssertFalse(KBPollingPolicy.calismali(phase: .active, ekranGorunur: false))
    }

    func testPollerBaslatipDurdurulabilir() async {
        let poller = KBPoller(channel: .komuta)
        XCTAssertFalse(poller.isRunning)

        let sayac = KBSayac()
        poller.start { await sayac.artir() }
        XCTAssertTrue(poller.isRunning)

        // İlk tur hemen çalışır; aralığı beklemeye gerek yok.
        try? await Task.sleep(nanoseconds: 50_000_000)
        poller.stop()
        let turSayisi = await sayac.deger

        XCTAssertFalse(poller.isRunning)
        XCTAssertEqual(turSayisi, 1)
    }

    func testGizliEkranSyncPolleriDurdurur() async {
        let poller = KBPoller(channel: .bildirim)
        poller.sync(phase: .active, ekranGorunur: true) {}
        XCTAssertTrue(poller.isRunning)

        poller.sync(phase: .background, ekranGorunur: true) {}
        XCTAssertFalse(poller.isRunning)
    }

    // MARK: - Yardımcılar

    private static func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try JSONDecoder.api.decode(type, from: Data(json.utf8))
    }

    private static func arac(id: String, gorevde: Bool, konumlu: Bool) -> KomutaAracDTO {
        let gorev = gorevde ? "{\"gorevNo\":\"2026-0001\",\"tanim\":null}" : "null"
        let konum = konumlu ? "\"lat\":40.6,\"lng\":43.09" : "\"lat\":null,\"lng\":null"
        // swiftlint:disable:next force_try
        return try! decode(
            KomutaAracDTO.self,
            """
            {"id":"\(id)","plaka":"36 AB 0\(id)","tip":null,\(konum),
             "konumZamani":null,"taze":false,"aktifGorev":\(gorev),
             "rotaUzaklikM":null,"rotada":null}
            """
        )
    }

    private static let komutaJSON = """
    {
      "zaman":"2026-07-31T10:00:00Z",
      "kpi":{"acikSikayet":12,"slaLt24":5,"sla1to3":4,"slaGt3":3,
        "bekleyenAtama":1,"gecikenRota":1,"devamEdenGorev":4,
        "tazeKonumluArac":2,"toplamArac":3,"bugunOperasyon":7},
      "araclar":[
        {"id":"a1","plaka":"36 AB 001","tip":"Greyder","lat":40.60,"lng":43.09,
         "konumZamani":"2026-07-31T09:58:00Z","taze":true,
         "aktifGorev":{"gorevNo":"2026-0001","tanim":"Kale Yolu tuzlama"},
         "rotaUzaklikM":40,"rotada":true},
        {"id":"a2","plaka":"36 AB 002","tip":"Kamyon","lat":40.62,"lng":43.11,
         "konumZamani":"2026-07-31T09:59:00Z","taze":true,"aktifGorev":null,
         "rotaUzaklikM":320,"rotada":false},
        {"id":"a3","plaka":"36 AB 003","tip":null,"lat":null,"lng":null,
         "konumZamani":null,"taze":false,"aktifGorev":null,
         "rotaUzaklikM":null,"rotada":null}
      ],
      "sikayetler":[
        {"id":"s1","sikayetNo":"2026-001","oncelik":"YUKSEK",
         "aciklama":"Yol çökmesi","lat":40.60,"lng":43.09,
         "kayitTarihi":"2026-07-25T08:00:00Z","bucket":"gt3"}
      ],
      "bekleyenler":[
        {"jobId":"j1","tip":"COP","routeAd":"Merkez","plaka":"36 AB 002",
         "aracTip":"Kamyon","mesafeKm":4.2,"sureDk":11,"tahmini":true,
         "gerekceOzet":"süre 38 · tip 20","createdAt":"2026-07-31T09:45:00Z"}
      ],
      "gecikenRotalar":[
        {"id":"r1","tip":"KIS","ad":"Kale Yolu","oncelik":1,"esikSaat":12,
         "sonIslem":"2026-07-30T20:00:00Z",
         "koordinatlar":[[40.60,43.09],[40.62,43.11]]}
      ]
    }
    """
}

/// Poller'ın kaç tur koştuğunu iş parçacığından bağımsız sayar.
private actor KBSayac {
    private(set) var deger = 0

    func artir() { deger += 1 }
}
