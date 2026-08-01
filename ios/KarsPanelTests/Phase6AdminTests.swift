import XCTest
@testable import KarsPanel

/// Faz 6: tanımlar CRUD sözleşmesi, denetim izi filtreleri ve rapor verisi.
@MainActor
final class Phase6AdminTests: XCTestCase {
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

    // MARK: - Tanımlar

    func testTanimlarYanitiCozumlenir() async throws {
        StubURLProtocol.stub = .json(Self.tanimlarJSON)

        let veri = try await client.fetchTanimlar()

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/definitions")
        XCTAssertTrue(veri.otomatikAtama)
        XCTAssertEqual(veri.mahalleler.count, 2)
        // Pasif kayıtlar da gelir; ekran onları soluk gösterir
        XCTAssertFalse(veri.mahalleler[1].aktif)
        XCTAssertEqual(veri.mudurlukler.first?.shortName, "Temizlik")
        XCTAssertEqual(veri.sikayetTurleri.first?.defaultDepartmentId, "d1")
        XCTAssertEqual(veri.kullanicilar.first?.role, .DEPARTMENT_MANAGER)
        XCTAssertNil(veri.kullanicilar[1].email)
        XCTAssertNotNil(veri.kullanicilar.first?.lastLoginAt)
    }

    func testKullaniciGuncellemesiBosEpostayiGonderirSifreyiAtlar() async throws {
        StubURLProtocol.stub = .json(Self.kullaniciJSON)

        _ = try await client.updateKullanici(
            id: "u1",
            KullaniciGuncelleRequestDTO(
                name: "Ali Veli",
                phone: "05551112233",
                email: "",
                role: UserRole.CALL_CENTER.rawValue,
                departmentId: nil,
                aktif: true,
                password: nil
            )
        )

        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "PATCH")
        XCTAssertEqual(
            StubURLProtocol.lastRequest?.url?.path,
            "/api/v1/definitions/kullanicilar/u1"
        )
        let govde = try Self.govde()
        // Boş metin "e-postayı temizle" demektir; alan mutlaka gitmeli
        XCTAssertEqual(govde["email"] as? String, "")
        // Şifre boşsa hiç gönderilmez, aksi halde sunucu şeması reddeder
        XCTAssertNil(govde["password"])
        XCTAssertEqual(govde["aktif"] as? Bool, true)
    }

    func testMudurlukOlusturmaGovdesiKisaAdiTasir() async throws {
        StubURLProtocol.stub = .json(
            #"{"id":"d9","name":"Park Bahçeler","shortName":"Park","aktif":true}"#
        )

        _ = try await client.createMudurluk(
            MudurlukRequestDTO(name: "Park Bahçeler", shortName: "Park", aktif: true)
        )

        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "POST")
        XCTAssertEqual(
            StubURLProtocol.lastRequest?.url?.path,
            "/api/v1/definitions/mudurlukler"
        )
        XCTAssertEqual(try Self.govde()["shortName"] as? String, "Park")
    }

    func testOtomatikAtamaAyariPutIleGonderilir() async throws {
        StubURLProtocol.stub = .json(#"{"otomatikAtama":false}"#)

        let sonuc = try await client.setOtomatikAtama(false)

        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "PUT")
        XCTAssertEqual(
            StubURLProtocol.lastRequest?.url?.path,
            "/api/v1/definitions/dispatch-ayari"
        )
        XCTAssertEqual(try Self.govde()["otomatikAtama"] as? Bool, false)
        XCTAssertFalse(sonuc.otomatikAtama)
    }

    func testCakisanAdSunucuMesajiylaBildirilir() async {
        StubURLProtocol.stub = .json(
            #"{"error":"Bu mahalle zaten kayıtlı"}"#,
            statusCode: 409
        )

        do {
            _ = try await client.createMahalle(name: "Yenişehir")
            XCTFail("Çakışan ad hata vermeliydi")
        } catch {
            XCTAssertEqual(APIError.describe(error), "Bu mahalle zaten kayıtlı")
        }
    }

    // MARK: - Kullanıcı form doğrulaması

    func testKullaniciFormuSunucuKurallariniOncedenUygular() {
        XCTAssertEqual(
            KullaniciFormValidation.hata(
                ad: "  ",
                telefon: "05551112233",
                rol: .CALL_CENTER,
                departmentId: nil,
                sifre: "Sifre123",
                sifreZorunlu: true
            ),
            "Ad zorunlu"
        )

        XCTAssertEqual(
            KullaniciFormValidation.hata(
                ad: "Ali",
                telefon: "0555111",
                rol: .CALL_CENTER,
                departmentId: nil,
                sifre: "Sifre123",
                sifreZorunlu: true
            ),
            "Telefon en az 10 hane olmalı"
        )

        XCTAssertEqual(
            KullaniciFormValidation.hata(
                ad: "Ali",
                telefon: "05551112233",
                rol: .DEPARTMENT_MANAGER,
                departmentId: nil,
                sifre: "Sifre123",
                sifreZorunlu: true
            ),
            "Müdürlük yöneticisi için müdürlük zorunlu"
        )

        XCTAssertEqual(
            KullaniciFormValidation.hata(
                ad: "Ali",
                telefon: "05551112233",
                rol: .CALL_CENTER,
                departmentId: nil,
                sifre: "sifresiz",
                sifreZorunlu: true
            ),
            "Şifre en az bir rakam içermeli"
        )

        // Güncellemede boş şifre "değiştirme" demektir, hata değil
        XCTAssertNil(
            KullaniciFormValidation.hata(
                ad: "Ali",
                telefon: "0555 111 22 33",
                rol: .CALL_CENTER,
                departmentId: nil,
                sifre: "",
                sifreZorunlu: false
            )
        )
    }

    // MARK: - Denetim izi

    func testDenetimFiltreleriSorguyaYazilir() async throws {
        StubURLProtocol.stub = .json(Self.denetimJSON)
        let baslangic = ISO8601DateFormatter().date(from: "2026-07-01T00:00:00Z")!

        _ = try await client.fetchDenetim(
            kullanici: "u1",
            islem: "GIRIS",
            varlik: "Complaint",
            baslangic: baslangic,
            page: 3,
            size: 50
        )

        let sorgu = Self.sorgu()
        XCTAssertEqual(sorgu["kullanici"], "u1")
        XCTAssertEqual(sorgu["islem"], "GIRIS")
        XCTAssertEqual(sorgu["varlik"], "Complaint")
        XCTAssertEqual(sorgu["baslangic"], "2026-07-01")
        XCTAssertEqual(sorgu["page"], "3")
        XCTAssertEqual(sorgu["size"], "50")
        // Verilmeyen filtre hiç gönderilmez
        XCTAssertNil(sorgu["bitis"])
    }

    func testDenetimKayitlariOkunurMetneCevrilir() async throws {
        StubURLProtocol.stub = .json(Self.denetimJSON)

        let liste = try await client.fetchDenetim()
        let ilk = liste.kayitlar[0]

        XCTAssertEqual(liste.toplamSayfa, 2)
        XCTAssertEqual(liste.islemler, ["GIRIS", "SIKAYET_ATA"])
        XCTAssertEqual(ilk.islemEtiketi, "Şikayet ataması")
        XCTAssertEqual(ilk.rolEtiketi, "Yönetici")
        // Kimliğin yalnızca son 6 karakteri gösterilir
        XCTAssertEqual(ilk.varlikMetni, "Complaint abcdef")
        XCTAssertEqual(ilk.detayMetni, "durum: KAPATILDI, gecikme: 3")

        let ikinci = liste.kayitlar[1]
        // Tanınmayan işlem ve rol kodları ham gösterilir
        XCTAssertEqual(ikinci.islemEtiketi, "BILINMEYEN_ISLEM")
        XCTAssertEqual(ikinci.rolEtiketi, "-")
        XCTAssertEqual(ikinci.varlikMetni, "—")
        XCTAssertNil(ikinci.detayMetni)
    }

    // MARK: - Raporlar

    func testRaporOzetiCozumlenir() async throws {
        StubURLProtocol.stub = .json(Self.raporOzetiJSON)

        let ozet = try await client.fetchRaporOzeti()

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/reports/ozet")
        XCTAssertEqual(ozet.sla.bucketLt24h, 4)
        XCTAssertEqual(ozet.sla.bucketGt3d, 2)
        XCTAssertEqual(ozet.sla.overdueUrgent.first?.oncelikEtiketi, "Çok Acil")
        XCTAssertEqual(ozet.sla.overdueUrgent.first?.oncelikTonu, .danger)
        XCTAssertEqual(ozet.sla.byDepartment.first?.ortKapanisGun, 2.5)
        // Müdürlüğü olmayan satır sabit bir kimliğe düşer
        XCTAssertEqual(ozet.sla.byDepartment[1].id, "atanmamis")
        XCTAssertNil(ozet.sla.byDepartment[1].ortKapanisGun)
        XCTAssertEqual(ozet.yakitBakimToplam, 18_500)
    }

    func testMahalleAnaliziVeIsMaliyetiCozumlenir() async throws {
        StubURLProtocol.stub = .json(Self.mahalleJSON)
        let mahalleler = try await client.fetchMahalleAnalizi(gun: 90)

        XCTAssertEqual(Self.sorgu()["gun"], "90")
        XCTAssertEqual(mahalleler.first?.id, "Yenişehir")
        XCTAssertEqual(mahalleler.first?.enSikTip, "Çöp toplama")
        XCTAssertNil(mahalleler[1].ortCozumGun)

        StubURLProtocol.stub = .json(Self.maliyetJSON)
        let maliyet = try await client.fetchIsMaliyeti()

        let satir = try XCTUnwrap(maliyet.satirlar.first)
        XCTAssertTrue(satir.maliyet.yakitTahmini)
        XCTAssertEqual(satir.maliyet.toplam, 1_450)
        XCTAssertEqual(maliyet.mudurlukToplamlari.first?.id, "Temizlik İşleri")
    }

    func testExportKatalogunuIzinBilgisiyleGetirir() async throws {
        StubURLProtocol.stub = .json(Self.exportJSON)

        let katalog = try await client.fetchExportKatalogu()

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/v1/reports")
        XCTAssertEqual(katalog.count, 2)
        XCTAssertTrue(katalog[0].izinli)
        XCTAssertTrue(katalog[0].tarihFiltreli)
        XCTAssertFalse(katalog[1].izinli)
    }

    func testExcelIndirmeDosyaAdiniBasliktanAlir() async throws {
        StubURLProtocol.stub = StubURLProtocol.Stub(
            data: Data("PK".utf8),
            headers: [
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": #"attachment; filename="sikayetler.xlsx""#,
            ]
        )

        let dosya = try await client.exportEntity("sikayetler")

        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.path, "/api/export/sikayetler")
        XCTAssertEqual(dosya.filename, "sikayetler.xlsx")
        XCTAssertFalse(dosya.data.isEmpty)
    }

    // MARK: - Nav

    func testDenetimYalnizcaYoneticiMenusundeGorunur() {
        let yonetici = NavItemCatalog.items(for: .ADMIN).map(\.destination)
        let cagriMerkezi = NavItemCatalog.items(for: .CALL_CENTER).map(\.destination)

        XCTAssertTrue(yonetici.contains(.denetim))
        XCTAssertFalse(cagriMerkezi.contains(.denetim))
        XCTAssertEqual(NavDestination.denetim.group, .yonetim)
    }

    func testDenetimYoluDerinBaglantiylaCozulur() {
        let link = KBDeepLink(href: "/denetim?islem=GIRIS")
        XCTAssertEqual(link?.destination, .denetim)
        XCTAssertNil(link?.route)
    }

    // MARK: - Yardımcılar

    private static func govde() throws -> [String: Any] {
        let data = try XCTUnwrap(StubURLProtocol.lastBody)
        return try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
    }

    private static func sorgu() -> [String: String] {
        guard let url = StubURLProtocol.lastRequest?.url,
              let parcalar = URLComponents(url: url, resolvingAgainstBaseURL: false)?
              .queryItems
        else { return [:] }
        return Dictionary(
            parcalar.compactMap { item in item.value.map { (item.name, $0) } },
            uniquingKeysWith: { _, son in son }
        )
    }

    // MARK: - Örnek yükler

    private static let tanimlarJSON = """
    {
      "mahalleler": [
        { "id": "m1", "name": "Yenişehir", "aktif": true },
        { "id": "m2", "name": "Bülbül", "aktif": false }
      ],
      "mudurlukler": [
        { "id": "d1", "name": "Temizlik İşleri", "shortName": "Temizlik", "aktif": true }
      ],
      "sikayetTurleri": [
        { "id": "t1", "name": "Çöp toplama", "aktif": true, "defaultDepartmentId": "d1" }
      ],
      "aracCinsleri": [
        { "id": "c1", "name": "Kamyon", "aktif": true }
      ],
      "kullanicilar": [
        {
          "id": "u1",
          "name": "Ayşe Yılmaz",
          "phone": "05551112233",
          "email": "ayse@kars.bel.tr",
          "role": "DEPARTMENT_MANAGER",
          "departmentId": "d1",
          "aktif": true,
          "lastLoginAt": "2026-07-30T08:15:00.000Z"
        },
        {
          "id": "u2",
          "name": "Mehmet Demir",
          "phone": "05559998877",
          "email": null,
          "role": "DRIVER",
          "departmentId": null,
          "aktif": false,
          "lastLoginAt": null
        }
      ],
      "otomatikAtama": true
    }
    """

    private static let kullaniciJSON = """
    {
      "id": "u1",
      "name": "Ali Veli",
      "phone": "05551112233",
      "email": null,
      "role": "CALL_CENTER",
      "departmentId": null,
      "aktif": true,
      "lastLoginAt": null
    }
    """

    private static let denetimJSON = """
    {
      "kayitlar": [
        {
          "id": "a1",
          "zaman": "2026-07-30T10:00:00.000Z",
          "userAd": "Ayşe Yılmaz",
          "rol": "ADMIN",
          "islem": "SIKAYET_ATA",
          "varlik": "Complaint",
          "varlikId": "clx123abcdef",
          "detay": { "durum": "KAPATILDI", "gecikme": 3 }
        },
        {
          "id": "a2",
          "zaman": "2026-07-30T09:00:00.000Z",
          "userAd": "Sistem",
          "rol": "-",
          "islem": "BILINMEYEN_ISLEM",
          "varlik": null,
          "varlikId": null,
          "detay": null
        }
      ],
      "toplam": 45,
      "page": 1,
      "size": 25,
      "toplamSayfa": 2,
      "islemler": ["GIRIS", "SIKAYET_ATA"],
      "varliklar": ["Complaint", "Task"]
    }
    """

    private static let raporOzetiJSON = """
    {
      "sla": {
        "bucketLt24h": 4,
        "bucket1to3d": 7,
        "bucketGt3d": 2,
        "overdueUrgent": [
          {
            "id": "s1",
            "sikayetNo": "SK-2026-0001",
            "arayanKisi": "Hasan Kaya",
            "oncelik": "COK_ACIL",
            "kayitTarihi": "2026-07-25T12:00:00.000Z",
            "departmentName": "Temizlik İşleri"
          }
        ],
        "byDepartment": [
          {
            "departmentId": "d1",
            "departmentName": "Temizlik İşleri",
            "acik": 5,
            "kapatilan30g": 12,
            "ortKapanisGun": 2.5
          },
          {
            "departmentId": null,
            "departmentName": "Atanmamış",
            "acik": 3,
            "kapatilan30g": 0,
            "ortKapanisGun": null
          }
        ]
      },
      "toplamSikayet": 320,
      "toplamArac": 42,
      "toplamGorev": 188,
      "yakitBakimToplam": 18500
    }
    """

    private static let mahalleJSON = """
    [
      {
        "ad": "Yenişehir",
        "toplam": 24,
        "acik": 5,
        "kapanan": 19,
        "ortCozumGun": 1.8,
        "enSikTip": "Çöp toplama"
      },
      {
        "ad": "Bülbül",
        "toplam": 3,
        "acik": 3,
        "kapanan": 0,
        "ortCozumGun": null,
        "enSikTip": "Yol onarımı"
      }
    ]
    """

    private static let maliyetJSON = """
    {
      "satirlar": [
        {
          "id": "g1",
          "gorevNo": "GRV-2026-0007",
          "plaka": "36AB123",
          "gorevTanimi": "Kar küreme",
          "mudurluk": "Temizlik İşleri",
          "maliyet": {
            "yakit": 900,
            "yakitTahmini": true,
            "malzeme": 300,
            "iscilik": 250,
            "diger": 0,
            "toplam": 1450
          }
        }
      ],
      "mudurlukToplamlari": [
        { "mudurluk": "Temizlik İşleri", "toplam": 1450 }
      ]
    }
    """

    private static let exportJSON = """
    [
      {
        "entity": "sikayetler",
        "baslik": "Şikayetler",
        "href": "/api/export/sikayetler",
        "izinli": true,
        "tarihFiltreli": true
      },
      {
        "entity": "kullanicilar",
        "baslik": "Kullanıcılar",
        "href": "/api/export/kullanicilar",
        "izinli": false,
        "tarihFiltreli": false
      }
    ]
    """
}
