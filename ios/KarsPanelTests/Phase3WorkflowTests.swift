import XCTest
@testable import KarsPanel

/// Faz 3 ekranlarının veri sözleşmesi: kontrol listesi matrisi, takip raporu,
/// çevrimdışı kuyruk ve PDF üretimi.
@MainActor
final class Phase3WorkflowTests: XCTestCase {
    private var client: APIClient!
    private var storeURL: URL!

    override func setUp() {
        super.setUp()
        StubURLProtocol.reset()
        client = APIClient(
            session: StubURLProtocol.makeSession(),
            baseURL: URL(string: "https://panel.test")!
        )
        storeURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("kuyruk-\(UUID().uuidString).json")
    }

    override func tearDown() {
        StubURLProtocol.reset()
        try? FileManager.default.removeItem(at: storeURL)
        client = nil
        storeURL = nil
        super.tearDown()
    }

    // MARK: - Kontrol listesi

    func testKontrolFormuMatrisiCozumlenir() async throws {
        StubURLProtocol.stub = .json("""
        {
          "id":"c1","sablonAdi":"Greyder","plaka":"36 AB 001","aracAdi":null,
          "ay":7,"yilDonem":2026,"durum":"TASLAK","duzenlenebilir":true,
          "sorumluOperatorTeknisyen":"Ali","santiyeLokasyon":"Şantiye 1",
          "operatorAdi":"Ali","teknisyenAdi":null,"sefAmirAdi":null,
          "onaylayanAdi":null,"onayTarihi":null,"createdAt":"2026-07-01T08:00:00Z",
          "periyotlar":["HAFTA_1","HAFTA_2","HAFTA_3","HAFTA_4","AYLIK_BAKIM"],
          "kategoriler":[
            {"kategori":"Motor","kalemler":[
              {"id":"k1","siraNo":1,"kontrolKalemi":"Yağ seviyesi","sonuclar":{
                "HAFTA_1":{"sonuc":"UYGUN","aciklamaNot":null},
                "HAFTA_2":{"sonuc":"ARIZALI","aciklamaNot":"Kaçak var"},
                "HAFTA_3":null,"HAFTA_4":null,"AYLIK_BAKIM":null}}
            ]}
          ],
          "arizaliSayisi":1,"dikkatSayisi":0
        }
        """)

        let form = try await client.fetchChecklist(id: "c1")
        let kalem = try XCTUnwrap(form.kategoriler.first?.kalemler.first)

        XCTAssertEqual(form.donem, "7/2026")
        XCTAssertEqual(form.durumu, .TASLAK)
        XCTAssertEqual(form.kalemSayisi, 1)
        XCTAssertEqual(kalem.sonuc(.HAFTA_1)?.degerlendirme, .UYGUN)
        XCTAssertEqual(kalem.sonuc(.HAFTA_2)?.degerlendirme, .ARIZALI)
        XCTAssertNil(kalem.sonuc(.AYLIK_BAKIM), "boş periyot nil dönmeli")
        XCTAssertEqual(kalem.notMetni, "Kaçak var")
    }

    func testKontrolKalemiKaydiPeriyotVeSonucuGonderir() async throws {
        StubURLProtocol.stub = .json("""
        {"id":"r1","templateItemId":"k1","periyot":"HAFTA_2","sonuc":"ARIZALI",
         "aciklamaNot":"Kaçak","bakimKaydiId":"b1"}
        """)

        let kayit = try await client.saveChecklistItem(
            submissionId: "c1",
            ChecklistItemRequestDTO(
                templateItemId: "k1",
                periyot: ChecklistPeriod.HAFTA_2.rawValue,
                sonuc: ChecklistResult.ARIZALI.rawValue,
                aciklamaNot: "Kaçak"
            )
        )

        XCTAssertEqual(
            StubURLProtocol.lastRequest?.url?.path,
            "/api/v1/checklists/c1/kalem"
        )
        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "PATCH")
        XCTAssertEqual(
            kayit.bakimKaydiId,
            "b1",
            "ARIZALI kalem otomatik bakım kaydı açar"
        )
    }

    // MARK: - Çevrimdışı kuyruk

    func testBaglantiYokkenKalemKuyrugaAlinirVeSonraGonderilir() async throws {
        let queue = ChecklistOfflineQueue(api: client, storeURL: storeURL)
        let istek = ChecklistItemRequestDTO(
            templateItemId: "k1",
            periyot: "HAFTA_1",
            sonuc: "UYGUN",
            aciklamaNot: nil
        )

        queue.enqueue(submissionId: "c1", request: istek)
        XCTAssertEqual(queue.pendingCount(submissionId: "c1"), 1)

        StubURLProtocol.transportError = URLError(.notConnectedToInternet)
        var gonderilen = await queue.flush()
        XCTAssertEqual(gonderilen, 0, "bağlantı yokken kuyruk korunur")
        XCTAssertEqual(queue.pending.count, 1)

        StubURLProtocol.transportError = nil
        StubURLProtocol.stub = .json("""
        {"id":"r1","templateItemId":"k1","periyot":"HAFTA_1","sonuc":"UYGUN",
         "aciklamaNot":null,"bakimKaydiId":null}
        """)
        gonderilen = await queue.flush()
        XCTAssertEqual(gonderilen, 1)
        XCTAssertTrue(queue.pending.isEmpty)
    }

    func testAyniKalemTekrarKuyruklanincaUzerineYazilir() {
        let queue = ChecklistOfflineQueue(api: client, storeURL: storeURL)
        for sonuc in ["UYGUN", "ARIZALI"] {
            queue.enqueue(
                submissionId: "c1",
                request: ChecklistItemRequestDTO(
                    templateItemId: "k1",
                    periyot: "HAFTA_1",
                    sonuc: sonuc,
                    aciklamaNot: nil
                )
            )
        }

        XCTAssertEqual(queue.pending.count, 1)
        XCTAssertEqual(queue.pending.first?.request.sonuc, "ARIZALI")
    }

    func testKaliciHataKuyruktanDusurulur() async {
        let queue = ChecklistOfflineQueue(api: client, storeURL: storeURL)
        queue.enqueue(
            submissionId: "c1",
            request: ChecklistItemRequestDTO(
                templateItemId: "k1",
                periyot: "HAFTA_1",
                sonuc: "UYGUN",
                aciklamaNot: nil
            )
        )

        StubURLProtocol.stub = .json(
            #"{"error":"Karara bağlanmış form değiştirilemez"}"#,
            statusCode: 409
        )

        let gonderilen = await queue.flush()
        XCTAssertEqual(gonderilen, 0)
        XCTAssertTrue(queue.pending.isEmpty, "kalıcı hata kuyruğu tıkamamalı")
        XCTAssertNotNil(queue.lastError)
    }

    func testKuyrukDiskeYazilirVeYenidenOkunur() {
        let ilk = ChecklistOfflineQueue(api: client, storeURL: storeURL)
        ilk.enqueue(
            submissionId: "c1",
            request: ChecklistItemRequestDTO(
                templateItemId: "k1",
                periyot: "HAFTA_1",
                sonuc: "DIKKAT_GEREKLI",
                aciklamaNot: "Kontrol edilecek"
            )
        )

        let yeniden = ChecklistOfflineQueue(api: client, storeURL: storeURL)
        XCTAssertEqual(yeniden.pending.count, 1)
        XCTAssertEqual(yeniden.pending.first?.request.sonuc, "DIKKAT_GEREKLI")
    }

    // MARK: - Görev takip raporu

    func testTakipRaporuCozumlenirVeOlaylarSiralanir() async throws {
        StubURLProtocol.stub = .json(Self.takipRaporuJSON)

        let rapor = try await client.fetchTaskTrackReport(id: "g1")
        let analiz = try XCTUnwrap(rapor.analiz)

        XCTAssertTrue(rapor.dispatchVar)
        XCTAssertFalse(analiz.veriYok)
        XCTAssertEqual(analiz.uyumYuzde, 92)
        XCTAssertEqual(rapor.zamanCizelgesi.map(\.tip), [
            "ROTA_GIRIS", "SAPMA", "DURAKLAMA_ROTA_DISI", "ROTA_CIKIS",
        ])
        XCTAssertEqual(rapor.zamanCizelgesi.first?.olay, .ROTA_GIRIS)
        XCTAssertNil(
            rapor.zamanCizelgesi.first?.bitisMs,
            "anlık olayın bitişi olmaz"
        )
        XCTAssertEqual(rapor.harita?.iz.count, 2)
        XCTAssertEqual(
            rapor.baslikAltMetni,
            "Kış operasyonu · Merkez Rota · 36 AB 001 · Ali Veli"
        )
    }

    func testGpsIzindekiBosHizDegeriKoordinatiDusurmez() throws {
        let harita = try JSONDecoder.api.decode(
            TrackMapDTO.self,
            from: Data("""
            {"planlanan":[],"eksikSegmentler":[],
             "iz":[[40.6,43.1,1000,null],[40.61,43.11,2000,12],[null,43.2,3000,8]]}
            """.utf8)
        )

        XCTAssertEqual(
            harita.izNoktalari,
            [[40.6, 43.1], [40.61, 43.11]],
            "hızı boş ping çizilir, konumu boş ping düşer"
        )
    }

    func testYenidenAnalizTekIstekAtar() async throws {
        StubURLProtocol.stub = .json(Self.takipRaporuJSON)

        _ = try await client.reanalyzeTaskTrack(id: "g1")

        XCTAssertEqual(StubURLProtocol.requestCount, 1, "rapor ikinci kez çekilmemeli")
        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "POST")
        XCTAssertEqual(
            StubURLProtocol.lastRequest?.url?.path,
            "/api/v1/tasks/g1/yeniden-analiz"
        )
    }

    // MARK: - Görev oluşturma

    func testGorevOlusturmaTumAlanlariGonderir() async throws {
        StubURLProtocol.stub = .json("""
        {"id":"g1","gorevNo":"GRV-2026-0001","durum":"PLANLANDI",
         "talepTarihi":"2026-07-31T08:00:00Z","baslangicTarihi":null,
         "bitisTarihi":null,"aciklama":null,"vehicleId":"v1",
         "vehicle":{"id":"v1","plaka":"36 AB 001"},"driverId":null,
         "talepEdenDepartmentId":null,"rota":null}
        """)

        _ = try await client.createTask(
            TaskCreateRequestDTO(
                vehicleId: "v1",
                talepEdenDepartmentId: "d1",
                driverId: "u1",
                gorevYeri: "Merkez",
                gorevTanimi: "Kar küreme",
                cikisTarihi: "2026-07-31T08:00:00Z",
                girisTarihi: nil,
                kmSayacCikis: 1000,
                kmSayacGiris: nil,
                onaylayanId: "u2",
                durum: TaskStatus.PLANLANDI.rawValue,
                not: nil,
                maliyet: 250.5
            )
        )

        let gonderilen = try XCTUnwrap(StubURLProtocol.lastBody)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: gonderilen) as? [String: Any]
        )
        XCTAssertEqual(json["vehicleId"] as? String, "v1")
        XCTAssertEqual(json["durum"] as? String, "PLANLANDI")
        XCTAssertEqual(json["kmSayacCikis"] as? Double, 1000)
        XCTAssertEqual(json["maliyet"] as? Double, 250.5)
        XCTAssertNil(json["girisTarihi"], "boş alan gönderilmemeli")
    }

    func testGorevBaslatVeKapatEylemAdiGonderir() async throws {
        StubURLProtocol.stub = .json(Self.gorevDetayJSON)

        _ = try await client.startTask(id: "g1", kmSayacCikis: 1200)
        var json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: XCTUnwrap(StubURLProtocol.lastBody))
                as? [String: Any]
        )
        XCTAssertEqual(json["action"] as? String, "start")

        _ = try await client.closeTask(
            id: "g1",
            girisTarihi: "2026-07-31T17:00:00Z",
            kmSayacGiris: 1250,
            durum: .TAMAMLANDI
        )
        json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: XCTUnwrap(StubURLProtocol.lastBody))
                as? [String: Any]
        )
        XCTAssertEqual(json["action"] as? String, "close")
        XCTAssertEqual(json["durum"] as? String, "TAMAMLANDI")
    }

    // MARK: - Şikayet atama

    func testAtamaGovdesiAyrimliBirlesimOlarakKodlanir() async throws {
        StubURLProtocol.stub = .json(#"{"ok":true}"#)

        _ = try await client.assignComplaint(
            id: "s1",
            .arac(vehicleId: "v1", personnelIds: ["p1", "p2"])
        )

        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: XCTUnwrap(StubURLProtocol.lastBody))
                as? [String: Any]
        )
        XCTAssertEqual(json["islem"] as? String, "ARAC")
        XCTAssertEqual(json["vehicleId"] as? String, "v1")
        XCTAssertEqual(json["personnelIds"] as? [String], ["p1", "p2"])
        XCTAssertEqual(
            StubURLProtocol.lastRequest?.url?.path,
            "/api/v1/complaints/s1/atama"
        )
    }

    func testSikayetOlayiDurumDegisiminiOkunurYapar() throws {
        let json = """
        {"id":"o1","tip":"DURUM_DEGISTI","kullanici":"Ali",
         "eskiDurum":"ACIK","yeniDurum":"KAPATILDI",
         "createdAt":"2026-07-31T10:00:00Z"}
        """
        let olay = try JSONDecoder.api.decode(
            ComplaintEventDTO.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(olay.label, "Durum değiştirildi")
        XCTAssertEqual(olay.degisim, "Açık → Kapalı")
    }

    // MARK: - PDF

    /// PDF motoru UIKit'e bağlı; çekirdek testler macOS'ta koştuğu için atlanır.
    #if canImport(UIKit)
    func testIsEmriPdfUretilir() throws {
        let json = """
        {"id":"s1","sikayetNo":"SKY-2026-0001","kanal":"TELEFON",
         "kayitTarihi":"2026-07-31T08:00:00Z","arayanKisi":"Ayşe",
         "telefon":"05001112233","neighborhood":{"id":"m1","name":"Merkez"},
         "acikAdres":"Cadde 1","complaintType":{"id":"t1","name":"Çukur"},
         "aciklama":"Yolda çukur var","departmentId":"d1",
         "department":{"id":"d1","name":"Fen İşleri"},"oncelik":"ACIL",
         "durum":"ACIK","kapanisTarihi":null,"cozumNotu":null,"vehicleId":null,
         "vehicle":null,"soforAdi":null,"soforTelefonu":null,
         "onaylayanAdi":"Mehmet","lat":40.6,"lng":43.1,
         "fotograflar":[],"personel":[],"olaylar":[]}
        """
        let sikayet = try JSONDecoder.api.decode(
            ComplaintDetailDTO.self,
            from: Data(json.utf8)
        )

        let pdf = KBPDFRenderer.render(ComplaintWorkOrderPDF(complaint: sikayet))

        XCTAssertGreaterThan(pdf.count, 1000)
        XCTAssertEqual(
            String(data: pdf.prefix(4), encoding: .ascii),
            "%PDF",
            "geçerli bir PDF üretilmeli"
        )
    }
    #endif

    // MARK: - Sabitler

    private static let gorevDetayJSON = """
    {"id":"g1","gorevNo":"GRV-2026-0001","durum":"DEVAM_EDIYOR",
     "talepTarihi":"2026-07-31T08:00:00Z","gorevYeri":"Merkez",
     "gorevTanimi":"Kar küreme","cikisTarihi":"2026-07-31T09:00:00Z",
     "girisTarihi":null,"sureSaat":null,"kmSayacCikis":1200,
     "kmSayacGiris":null,"kmFarki":null,"maliyet":null,"not":null,
     "vehicleId":"v1",
     "vehicle":{"id":"v1","plaka":"36 AB 001","ad":null,"tip":"Greyder"},
     "driverId":"u1","sofor":{"id":"u1","ad":"Ali Veli","telefon":"05001112233"},
     "talepEdenDepartmentId":null,"talepEdenMudurluk":null,
     "onaylayanId":null,"onaylayan":null,"dispatch":null,"takipOzeti":null}
    """

    private static let takipRaporuJSON = """
    {
      "gorevNo":"GRV-2026-0001","gorevTanimi":"Kar küreme","plaka":"36 AB 001",
      "soforAdi":"Ali Veli","cikisTarihi":"2026-07-31T09:00:00Z",
      "girisTarihi":"2026-07-31T12:00:00Z","dispatchVar":true,
      "analiz":{
        "tip":"KIS","routeAd":"Merkez Rota","sonuc":"TAMAMLANDI",
        "veriKalitesi":"IYI","notlar":null,
        "rotaGiris":"2026-07-31T09:10:00Z","rotaCikis":"2026-07-31T11:50:00Z",
        "sureDk":160,"uyumYuzde":92,"kapsamaYuzde":88,"maxSapmaM":240,
        "ortSapmaM":35,"ortalamaHizKmh":18,"maxHizKmh":46,"toplamMesafeKm":24.5,
        "pingSayisi":320,"ortPingAraligiSn":30,
        "guncellemeTarihi":"2026-07-31T12:05:00Z"
      },
      "sapmalar":[{"baslangicMs":1000,"bitisMs":2000,"sureDk":12,
        "maxMesafeM":240,"lat":40.6,"lng":43.1,"izler":[[40.6,43.1]]}],
      "duraklamalar":[{"lat":40.62,"lng":43.12,"baslangicMs":3000,
        "bitisMs":4000,"sureDk":8,"rotaUzerinde":false}],
      "veriBosluklari":[],
      "zamanCizelgesi":[
        {"tip":"ROTA_GIRIS","baslangicMs":500,"bitisMs":null,"sureDk":null,
         "maxMesafeM":null},
        {"tip":"SAPMA","baslangicMs":1000,"bitisMs":2000,"sureDk":12,
         "maxMesafeM":240},
        {"tip":"DURAKLAMA_ROTA_DISI","baslangicMs":3000,"bitisMs":4000,
         "sureDk":8,"maxMesafeM":null},
        {"tip":"ROTA_CIKIS","baslangicMs":5000,"bitisMs":null,"sureDk":null,
         "maxMesafeM":null}
      ],
      "toplamSapmaDk":12,"toplamDuraklamaDk":8,
      "harita":{
        "planlanan":[[40.6,43.1],[40.61,43.11]],
        "eksikSegmentler":[[[40.6,43.1],[40.605,43.105]]],
        "iz":[[40.6,43.1,1000,null],[40.61,43.11,2000,12]]
      }
    }
    """
}
