import XCTest
@testable import KarsPanel

@MainActor
final class KBListStoreTests: XCTestCase {
    func testBasariliYuklemeItemlariDoldurur() async {
        let store = KBListStore { ["a", "b"] }
        await store.load()

        XCTAssertEqual(store.items, ["a", "b"])
        XCTAssertFalse(store.isEmpty)
        XCTAssertNil(store.errorMessage)
        XCTAssertTrue(store.hasLoadedOnce)
    }

    func testBosSonucBosDurumOlarakIsaretlenir() async {
        let store = KBListStore { [String]() }
        await store.load()

        XCTAssertTrue(store.isEmpty)
        XCTAssertNil(store.errorMessage)
    }

    // Ekranlardaki `try?` kullanımının yerini alan asıl davranış: hata yutulmaz.
    func testYuklemeHatasiYuzeyeCikar() async {
        let store = KBListStore<String> { throw APIError.forbidden }
        await store.load()

        XCTAssertEqual(store.errorMessage, "Bu işlem için yetkiniz yok")
        XCTAssertTrue(store.isEmpty)
    }

    func testIptalEdilenYuklemeHataUretmez() async {
        let store = KBListStore<String> { throw CancellationError() }
        await store.load()

        XCTAssertNil(store.errorMessage)
    }

    func testLoadIfNeededSadeceBirKezCalisir() async {
        var cagri = 0
        let store = KBListStore<String> {
            cagri += 1
            return ["x"]
        }
        await store.loadIfNeeded()
        await store.loadIfNeeded()

        XCTAssertEqual(cagri, 1)
    }

    func testBasariliMutasyonToastYazarVeListeyiTazeler() async {
        var kaynak = ["a"]
        let store = KBListStore { kaynak }
        await store.load()

        let ok = await store.mutate(success: "Eklendi") { kaynak.append("b") }

        XCTAssertTrue(ok)
        XCTAssertEqual(store.toastMessage, "Eklendi")
        XCTAssertEqual(store.items, ["a", "b"])
        XCTAssertNil(store.errorMessage)
    }

    func testBasarisizMutasyonHatayiGosterirVeToastYazmaz() async {
        let store = KBListStore { ["a"] }
        await store.load()

        let ok = await store.mutate(success: "Eklendi") { throw APIError.server(500, "Sunucu patladı") }

        XCTAssertFalse(ok)
        XCTAssertEqual(store.errorMessage, "Sunucu patladı")
        XCTAssertNil(store.toastMessage)
        XCTAssertFalse(store.isSubmitting)
    }

    // Zayıf şebekede yenilemeye çalışan kullanıcının dolu listesi silinmemeli.
    func testYenilemeHatasiEldekiKayitlariKorur() async {
        var basarisiz = false
        let store = KBListStore<String> {
            if basarisiz { throw APIError.network(URLError(.timedOut)) }
            return ["a", "b"]
        }
        await store.load()
        XCTAssertEqual(store.items, ["a", "b"])

        basarisiz = true
        await store.load()

        XCTAssertEqual(store.items, ["a", "b"], "Hata sonrası liste boşaltılmamalı")
        XCTAssertNotNil(store.errorMessage)
    }

    func testSayfasizMagazaDahaFazlaSunmaz() async {
        let store = KBListStore { ["a", "b"] }
        await store.load()

        XCTAssertFalse(store.canLoadMore)
    }

    // Gelen satır sayısı istenen sınıra dayandıysa arkada daha fazlası var demektir.
    func testSinirDolduysaDahaFazlaSunulur() async {
        let store = KBListStore(pageSize: 2) { limit in
            Array(["a", "b", "c", "d", "e"].prefix(limit))
        }
        await store.load()

        XCTAssertEqual(store.items, ["a", "b"])
        XCTAssertTrue(store.canLoadMore)

        await store.loadMore()

        XCTAssertEqual(store.limit, 4)
        XCTAssertEqual(store.items, ["a", "b", "c", "d"])
        XCTAssertTrue(store.canLoadMore)

        await store.loadMore()

        XCTAssertEqual(store.items, ["a", "b", "c", "d", "e"])
        XCTAssertFalse(store.canLoadMore, "Sınırın altında sonuç geldiyse liste tükenmiştir")
    }

    func testYenidenYuklemeOncekiHatayiTemizler() async {
        var basarisiz = true
        let store = KBListStore<String> {
            if basarisiz { throw APIError.unauthorized }
            return ["ok"]
        }
        await store.load()
        XCTAssertNotNil(store.errorMessage)

        basarisiz = false
        await store.load()
        XCTAssertNil(store.errorMessage)
        XCTAssertEqual(store.items, ["ok"])
    }
}
