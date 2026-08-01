import XCTest
@testable import KarsPanel

@MainActor
final class APIClientTests: XCTestCase {
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

    // MARK: - URL kurulumu

    func testSorguParametreleriUrlEklenir() throws {
        let endpoint = Endpoint("/api/v1/complaints").adding([
            .optional("sekme", "acik"),
            .optional("bos", nil as String?),
            .optional("sayfa", 2),
        ])
        let url = try XCTUnwrap(client.makeURL(endpoint))

        XCTAssertEqual(url.path, "/api/v1/complaints")
        let items = try XCTUnwrap(
            URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        )
        XCTAssertEqual(items.count, 2, "nil değerler sorguya eklenmemeli")
        XCTAssertEqual(items.first { $0.name == "sekme" }?.value, "acik")
        XCTAssertEqual(items.first { $0.name == "sayfa" }?.value, "2")
    }

    func testTabanAdresYolunuEzmez() throws {
        let scoped = APIClient(
            session: StubURLProtocol.makeSession(),
            baseURL: URL(string: "https://panel.test")!
        )
        let url = try XCTUnwrap(scoped.makeURL(Endpoint("api/v1/dashboard")))
        XCTAssertEqual(url.absoluteString, "https://panel.test/api/v1/dashboard")
    }

    // MARK: - Kimlik doğrulama başlığı

    func testTokenVarsaBearerBasligiEklenir() async throws {
        client.setToken("abc123")
        StubURLProtocol.stub = .json(#"{"unread":0,"items":[]}"#)

        _ = try await client.fetchNotifications()

        XCTAssertEqual(
            StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization"),
            "Bearer abc123"
        )
    }

    func testLoginBearerBasligiGondermez() async throws {
        client.setToken("abc123")
        StubURLProtocol.stub = .json(
            #"{"token":"t","user":{"id":"1","name":"A","phone":"05","role":"ADMIN","departmentId":null}}"#
        )

        _ = try await client.login(phone: "05001112233", password: "x")

        XCTAssertNil(StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization"))
        XCTAssertEqual(StubURLProtocol.lastRequest?.httpMethod, "POST")
    }

    // MARK: - Hata eşlemesi

    func testYetkisizYanitOturumKancasiniTetikler() async {
        client.setToken("expired")
        StubURLProtocol.stub = .json(#"{"error":"Oturum gerekli"}"#, statusCode: 401)

        var kancaCagrildi = false
        client.onUnauthorized = { kancaCagrildi = true }

        do {
            _ = try await client.fetchDashboard()
            XCTFail("401 hata fırlatmalı")
        } catch let error as APIError {
            XCTAssertTrue(error.isAuthFailure)
        } catch {
            XCTFail("Beklenmeyen hata: \(error)")
        }

        XCTAssertTrue(kancaCagrildi, "401 alındığında oturum düşürülmeli")
    }

    func testSunucuHataMesajiOkunur() async {
        StubURLProtocol.stub = .json(#"{"error":"Plaka zorunlu"}"#, statusCode: 422)

        do {
            _ = try await client.fetchVehiclePage()
            XCTFail("422 hata fırlatmalı")
        } catch let APIError.server(code, message) {
            XCTAssertEqual(code, 422)
            XCTAssertEqual(message, "Plaka zorunlu")
        } catch {
            XCTFail("Beklenmeyen hata: \(error)")
        }
    }

    func testYasakYanitiForbiddenaEslenir() async {
        StubURLProtocol.stub = .json(#"{"error":"Yetkisiz"}"#, statusCode: 403)

        do {
            _ = try await client.fetchVehiclePage()
            XCTFail("403 hata fırlatmalı")
        } catch let error as APIError {
            guard case .forbidden = error else {
                return XCTFail("403 forbidden'a eşlenmeli, gelen: \(error)")
            }
        } catch {
            XCTFail("Beklenmeyen hata: \(error)")
        }
    }

    // MARK: - Çözümleme

    func testTarihAlanlariCozumlenir() async throws {
        StubURLProtocol.stub = .json("""
        [
          {"id":"1","telefon":"05","yon":"GELEN","icerik":"a","onayDurumu":"ONAY_BEKLIYOR",
           "guven":0.9,"createdAt":"2026-07-31T10:00:00.000Z"},
          {"id":"2","telefon":"05","yon":"GELEN","icerik":"b","onayDurumu":"ONAY_BEKLIYOR",
           "guven":null,"createdAt":"2026-07-31T10:00:00Z"}
        ]
        """)

        let mesajlar = try await client.fetchWhatsAppQueue()

        XCTAssertEqual(mesajlar.count, 2)
        XCTAssertNotNil(mesajlar[0].createdAt, "kesirli saniyeli ISO8601 çözümlenmeli")
        XCTAssertNotNil(mesajlar[1].createdAt, "kesirsiz ISO8601 çözümlenmeli")
    }

    // MARK: - multipart

    func testMultipartGovdesiSinirVeParcalariIcerir() throws {
        let body = APIClient.multipartBody(
            parts: [
                .field("aciklama", "Çukur"),
                .file("foto", filename: "a.jpg", mimeType: "image/jpeg", data: Data([0xFF, 0xD8])),
            ],
            boundary: "SINIR"
        )
        let text = try XCTUnwrap(String(data: body, encoding: .isoLatin1))

        XCTAssertTrue(text.hasPrefix("--SINIR\r\n"))
        XCTAssertTrue(text.hasSuffix("--SINIR--\r\n"))
        XCTAssertTrue(text.contains(#"Content-Disposition: form-data; name="aciklama""#))
        XCTAssertFalse(
            text.contains(#"name="aciklama"; filename"#),
            "metin alanı filename taşımamalı"
        )
        XCTAssertTrue(
            text.contains(#"name="foto"; filename="a.jpg""#)
        )
        XCTAssertTrue(text.contains("Content-Type: image/jpeg"))
    }

    func testMultipartYuklemeIcerikTipiniAyarlar() async throws {
        StubURLProtocol.stub = .json(#"{"ok":true,"vehicleId":null}"#)

        let _: LocationPingResponseDTO = try await client.upload(
            Endpoint("/api/v1/harita/engeller", method: .post),
            parts: [.field("aciklama", "Çukur")]
        )

        let contentType = try XCTUnwrap(
            StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Content-Type")
        )
        XCTAssertTrue(contentType.hasPrefix("multipart/form-data; boundary="))
        XCTAssertTrue(contentType.contains("KarsPanel-"))
    }

    // MARK: - İkili indirme

    func testExportDosyaAdiniContentDispositiondanOkur() async throws {
        StubURLProtocol.stub = StubURLProtocol.Stub(
            statusCode: 200,
            data: Data([0x50, 0x4B, 0x03, 0x04]),
            headers: [
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": #"attachment; filename="sikayetler.xlsx""#,
            ]
        )

        let file = try await client.exportEntity("sikayetler")

        XCTAssertEqual(file.filename, "sikayetler.xlsx")
        XCTAssertEqual(file.data.count, 4)
        XCTAssertTrue(file.mimeType.contains("spreadsheetml"))
    }

    func testExportBasliksizYanitYolaGeriDoner() throws {
        let response = HTTPURLResponse(
            url: URL(string: "https://panel.test/api/export/araclar")!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: [:]
        )!
        XCTAssertEqual(
            APIClient.filename(from: response, fallbackPath: "/api/export/araclar"),
            "araclar"
        )
    }

    func testExportHatasiJsonOlarakYuzeyeCikar() async {
        StubURLProtocol.stub = .json(
            #"{"error":"Export limiti 10000 satır. Tarihi daraltın."}"#,
            statusCode: 400
        )

        do {
            _ = try await client.exportEntity("sikayetler")
            XCTFail("400 hata fırlatmalı")
        } catch let APIError.server(_, message) {
            XCTAssertEqual(message, "Export limiti 10000 satır. Tarihi daraltın.")
        } catch {
            XCTFail("Beklenmeyen hata: \(error)")
        }
    }

    // MARK: - Sayfalama

    func testSayfaIstegiSorguUretir() {
        let page = PageRequest(page: 3, pageSize: 25)
        let values = Dictionary(
            uniqueKeysWithValues: page.queryItems.map { ($0.name, $0.value) }
        )
        XCTAssertEqual(values["page"], "3")
        XCTAssertEqual(values["pageSize"], "25")
        XCTAssertEqual(page.next.page, 4)
    }

    func testSayfaliYanitDahaFazlaVarMiHesaplar() throws {
        let json = #"{"items":[],"total":120,"page":2,"pageSize":50}"#
        let paged = try JSONDecoder.api.decode(
            PagedResponse<ComplaintDTO>.self,
            from: Data(json.utf8)
        )
        XCTAssertTrue(paged.hasMore, "100 < 120 olduğu için sonraki sayfa var")

        let sonSayfa = #"{"items":[],"total":100,"page":2,"pageSize":50}"#
        let bitti = try JSONDecoder.api.decode(
            PagedResponse<ComplaintDTO>.self,
            from: Data(sonSayfa.utf8)
        )
        XCTAssertFalse(bitti.hasMore)
    }
}
