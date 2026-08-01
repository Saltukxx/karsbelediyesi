import XCTest
@testable import KarsPanel

/// Swift portlarının web `packages/shared` testleriyle aynı sonucu vermesi.
/// Beklenen değerler `calculations.test.ts` ve `extended-calculations.test.ts`
/// içindeki Excel doğrulamalarından birebir alınmıştır.
final class CalculationParityTests: XCTestCase {
    // MARK: - Personel mesai (Excel H / I / J)

    func testNormalSaatOgleMolasiniDuser() {
        XCTAssertEqual(WorkHourMath.normalSaat(giris: "08:00", cikis: "17:00")!, 8, accuracy: 1e-9)
        XCTAssertEqual(WorkHourMath.normalSaat(giris: "08:00", cikis: "12:00")!, 4, accuracy: 1e-9)
        XCTAssertEqual(WorkHourMath.normalSaat(giris: "08:00", cikis: "12:30")!, 4, accuracy: 1e-9)
        XCTAssertEqual(WorkHourMath.normalSaat(giris: "13:00", cikis: "17:00")!, 4, accuracy: 1e-9)
    }

    func testNormalSaatMesaiPenceresiDisiniSaymaz() {
        XCTAssertEqual(WorkHourMath.normalSaat(giris: "07:00", cikis: "17:00")!, 8, accuracy: 1e-9)
        XCTAssertEqual(WorkHourMath.normalSaat(giris: "08:00", cikis: "18:00")!, 8, accuracy: 1e-9)
        XCTAssertEqual(
            WorkHourMath.normalSaat(giris: "09:30", cikis: "16:15")!,
            5.75,
            accuracy: 1e-9
        )
    }

    func testMesaiSaati17SonrasiniSayar() {
        XCTAssertEqual(WorkHourMath.mesaiSaat(cikis: "17:00")!, 0, accuracy: 1e-9)
        XCTAssertEqual(WorkHourMath.mesaiSaat(cikis: "19:30")!, 2.5, accuracy: 1e-9)
        XCTAssertEqual(WorkHourMath.mesaiSaat(cikis: "18:00")!, 1, accuracy: 1e-9)
    }

    func testToplamSaatNormalArtiMesai() {
        XCTAssertEqual(WorkHourMath.toplamSaat(giris: "08:00", cikis: "19:00")!, 10, accuracy: 1e-9)
    }

    func testAracCalismaSaatiGeceDevriniDestekler() {
        XCTAssertEqual(
            WorkHourMath.aracCalismaSaati(giris: "08:00", cikis: "17:00")!,
            9,
            accuracy: 1e-9
        )
        XCTAssertEqual(
            WorkHourMath.aracCalismaSaati(giris: "22:00", cikis: "06:00")!,
            8,
            accuracy: 1e-9
        )
        XCTAssertEqual(
            WorkHourMath.aracCalismaSaati(giris: "23:30", cikis: "00:30")!,
            1,
            accuracy: 1e-9
        )
    }

    func testBozukSaatBicimiNilDoner() {
        XCTAssertNil(WorkHourMath.saatKesri("8:00"))
        XCTAssertNil(WorkHourMath.saatKesri("24:00"))
        XCTAssertNil(WorkHourMath.saatKesri("08:60"))
        XCTAssertNil(WorkHourMath.saatKesri("0800"))
        XCTAssertNil(WorkHourMath.toplamSaat(giris: "abc", cikis: "17:00"))
    }

    // MARK: - Agrega fiziksel maliyet

    /// Servisteki Zod varsayılanlarıyla aynı senaryo (`services/agrega.ts`).
    private var varsayilanFiziksel: AgregaMath.FizikselParams {
        AgregaMath.FizikselParams(
            mesafeKm: 3,
            motorinFiyat: 45,
            elektrikFiyat: 3.2,
            sokumYakitLtSaat: 18,
            sokumAmortisman: 350,
            sokumKapasiteTonSaat: 45,
            yuklemeYakitLtSaat: 16,
            yuklemeAmortisman: 300,
            yuklemeKapasiteTonSaat: 90,
            kamyonKapasiteTon: 20,
            kamyonYakitLtKm: 0.42,
            seferHizKmSaat: 30,
            yuklemeBosaltmaDk: 10,
            kamyonAmortisman: 180,
            kiriciKw: 400,
            yukFaktoru: 0.75,
            kiriciKapasiteTonSaat: 120,
            oran05: 0.3,
            oran512: 0.25,
            oran1219: 0.25,
            oran1932: 0.2,
            donemUretimTon: 5000
        )
    }

    func testFizikselAsamaMaliyetleri() {
        let s = AgregaMath.fizikselMaliyet(varsayilanFiziksel)

        // Aşama 1: (18 × 45 + 350) / 45
        XCTAssertEqual(s.asama1, (18 * 45 + 350) / 45, accuracy: 1e-9)
        // Aşama 2: (16 × 45 + 300) / 90
        XCTAssertEqual(s.asama2, (16 * 45 + 300) / 90, accuracy: 1e-9)
        // Aşama 4: 400 × 0.75 × 3.2 / 120
        XCTAssertEqual(s.asama4, 400 * 0.75 * 3.2 / 120, accuracy: 1e-9)
    }

    func testFizikselNakliyeAraDegerleri() {
        let s = AgregaMath.fizikselMaliyet(varsayilanFiziksel)

        XCTAssertEqual(s.seferMesafe, 6, accuracy: 1e-9)
        XCTAssertEqual(s.seferYakit, 0.42 * 6 * 45, accuracy: 1e-9)
        // 6/30 saat yol + 10 dk yükleme/boşaltma
        XCTAssertEqual(s.seferSure, 6.0 / 30 + 10.0 / 60, accuracy: 1e-9)
        XCTAssertEqual(
            s.asama3,
            (0.42 * 6 * 45 + 180 * (6.0 / 30 + 10.0 / 60)) / 20,
            accuracy: 1e-9
        )
    }

    func testFizikselToplamVeBoyutDagilimi() {
        let s = AgregaMath.fizikselMaliyet(varsayilanFiziksel)

        XCTAssertEqual(s.toplamBirim, s.asama1 + s.asama2 + s.asama3 + s.asama4, accuracy: 1e-9)
        XCTAssertEqual(s.boyutlar.count, 4)
        XCTAssertEqual(s.boyutlar[0].tonaj, 1500, accuracy: 1e-9)
        XCTAssertEqual(s.boyutlar[3].tonaj, 1000, accuracy: 1e-9)
        // Oranlar toplamı 1 olduğu için dönem maliyeti = üretim × birim
        XCTAssertEqual(s.donemToplamMaliyet, 5000 * s.toplamBirim, accuracy: 1e-6)
    }

    func testSifirKapasiteSonsuzYerineSifirDoner() {
        var p = varsayilanFiziksel
        p.sokumKapasiteTonSaat = 0
        p.kiriciKapasiteTonSaat = 0
        let s = AgregaMath.fizikselMaliyet(p)

        XCTAssertEqual(s.asama1, 0)
        XCTAssertEqual(s.asama4, 0)
        XCTAssertTrue(s.toplamBirim.isFinite)
    }

    // MARK: - Agrega proje modeli

    private var varsayilanProje: AgregaMath.ProjeParams {
        AgregaMath.ProjeParams(
            gunlukHedefTon: 500,
            kiriciYakitTon: 8.5,
            kiriciBakimTon: 3.2,
            yukleyiciYakitTon: 6.8,
            yukleyiciBakimTon: 2.5,
            nakliyeYakitTon: 10,
            elekElektrikTon: 2.5,
            elemeBakimTon: 6,
            yikamaSuTon: 1.2,
            genelGiderTon: 0,
            boyutlar: [
                .init(boyut: "0-5 mm", oran: 0.3, satisFiyati: 180, stokHedefi: 1000),
                .init(boyut: "5-12 mm", oran: 0.25, satisFiyati: 220, stokHedefi: 1000),
                .init(boyut: "12-19 mm", oran: 0.25, satisFiyati: 240, stokHedefi: 1000),
                .init(boyut: "19-32 mm", oran: 0.2, satisFiyati: 250, stokHedefi: 1000),
            ]
        )
    }

    func testProjeKalemToplamlari() {
        let s = AgregaMath.projeMaliyet(varsayilanProje)

        XCTAssertEqual(s.maden, 8.5 + 3.2 + 6.8 + 2.5, accuracy: 1e-9)
        XCTAssertEqual(s.nakliye, 10, accuracy: 1e-9)
        XCTAssertEqual(s.eleme, 2.5 + 6 + 1.2, accuracy: 1e-9)
        XCTAssertEqual(s.genel, 0, accuracy: 1e-9)
        XCTAssertEqual(s.birim, 40.7, accuracy: 1e-9)
        XCTAssertEqual(s.gunluk, 40.7 * 500, accuracy: 1e-6)
    }

    func testProjeAgirlikliSatisVeKar() {
        let s = AgregaMath.projeMaliyet(varsayilanProje)

        // (0.3×180 + 0.25×220 + 0.25×240 + 0.2×250) / 1.0
        let beklenen = 0.3 * 180 + 0.25 * 220 + 0.25 * 240 + 0.2 * 250
        XCTAssertEqual(s.agirlikliSatis, beklenen, accuracy: 1e-9)
        XCTAssertEqual(s.agirlikliKar, beklenen - 40.7, accuracy: 1e-9)
    }

    func testProjeBoyutDetayiVeStokToplamlari() {
        let s = AgregaMath.projeMaliyet(varsayilanProje)

        let ilk = s.boyutDetay[0]
        XCTAssertEqual(ilk.gunlukTon, 150, accuracy: 1e-9)
        XCTAssertEqual(ilk.uretimMaliyetiGun, 150 * 40.7, accuracy: 1e-6)
        XCTAssertEqual(ilk.brutKarTon, 180 - 40.7, accuracy: 1e-9)
        XCTAssertEqual(ilk.stokMaliyeti, 1000 * 40.7, accuracy: 1e-6)
        XCTAssertEqual(ilk.stokDegeri, 180_000, accuracy: 1e-6)

        XCTAssertEqual(s.toplamStokHedefi, 4000, accuracy: 1e-9)
        XCTAssertEqual(s.toplamStokDegeri, 890_000, accuracy: 1e-6)
        XCTAssertEqual(s.potansiyelKar, 890_000 - 4000 * 40.7, accuracy: 1e-6)
    }

    func testOranToplamiSifirsaBirKabulEdilir() {
        var p = varsayilanProje
        p.boyutlar = p.boyutlar.map {
            var b = $0
            b.oran = 0
            return b
        }
        let s = AgregaMath.projeMaliyet(p)
        XCTAssertEqual(s.agirlikliSatis, 0, accuracy: 1e-9)
    }

    func testAsamaPayiVeStokPayi() {
        XCTAssertEqual(AgregaMath.asamaPayi(asamaBirim: 5, toplamBirim: 20), 0.25, accuracy: 1e-9)
        XCTAssertEqual(AgregaMath.asamaPayi(asamaBirim: 5, toplamBirim: 0), 0)
        XCTAssertEqual(
            AgregaMath.stokPayi(stokHedefi: 1000, toplamStokHedefi: 4000),
            0.25,
            accuracy: 1e-9
        )
        XCTAssertEqual(AgregaMath.stokPayi(stokHedefi: 1000, toplamStokHedefi: 0), 0)
    }

    func testYillikVeAylikProjeksiyon() {
        XCTAssertEqual(
            AgregaMath.yillikUretim(gunlukHedefTon: 500, yillikCalismaGun: 250),
            125_000,
            accuracy: 1e-6
        )
        XCTAssertEqual(
            AgregaMath.yillikMaliyet(gunlukMaliyet: 20_350, yillikCalismaGun: 250),
            5_087_500,
            accuracy: 1e-6
        )
        XCTAssertEqual(
            AgregaMath.aylikMaliyet(gunlukMaliyet: 20_350, yillikCalismaGun: 250),
            20_350 * 250.0 / 12,
            accuracy: 1e-6
        )
    }

    // MARK: - Bitüm

    func testBitumSeferVeTasimaMaliyeti() {
        XCTAssertEqual(
            BitumMath.seferMaliyeti(mesafeKm: 250, yakitTlKm: 12),
            6000,
            accuracy: 1e-9
        )
        XCTAssertEqual(
            BitumMath.tonTasima(seferTl: 6000, tirKapasiteTon: 25),
            240,
            accuracy: 1e-9
        )
        XCTAssertEqual(BitumMath.tonTasima(seferTl: 6000, tirKapasiteTon: 0), 0)
    }

    func testBitumTirSeferiYukariYuvarlar() {
        XCTAssertEqual(BitumMath.tirSefer(miktarTon: 50, tirKapasiteTon: 25), 2)
        XCTAssertEqual(BitumMath.tirSefer(miktarTon: 51, tirKapasiteTon: 25), 3)
        XCTAssertEqual(BitumMath.tirSefer(miktarTon: 0.1, tirKapasiteTon: 25), 1)
        XCTAssertEqual(BitumMath.tirSefer(miktarTon: 50, tirKapasiteTon: 0), 0)
    }

    func testBitumDolulukVeDepoDurumu() {
        XCTAssertEqual(BitumMath.doluluk(stok: 30, kapasite: 100), 0.3, accuracy: 1e-9)
        XCTAssertEqual(BitumMath.doluluk(stok: 30, kapasite: 0), 0)

        XCTAssertEqual(
            BitumMath.depoDurumu(doluluk: 0.1, kritikEsik: 0.15, dusukEsik: 0.3),
            "KRITIK"
        )
        XCTAssertEqual(
            BitumMath.depoDurumu(doluluk: 0.25, kritikEsik: 0.15, dusukEsik: 0.3),
            "DUSUK"
        )
        XCTAssertEqual(
            BitumMath.depoDurumu(doluluk: 0.9, kritikEsik: 0.15, dusukEsik: 0.3),
            "NORMAL"
        )
        // Eşiğe eşit doluluk da o sınıfa girer (Excel <= karşılaştırması)
        XCTAssertEqual(
            BitumMath.depoDurumu(doluluk: 0.15, kritikEsik: 0.15, dusukEsik: 0.3),
            "KRITIK"
        )
    }

    func testBitumVarisMaliyeti() {
        XCTAssertEqual(
            BitumMath.varisMaliyetiTon(
                kaynakOrtFiyat: 20_000,
                tasimaMaliyeti: 12_000,
                miktarTon: 50
            ),
            20_240,
            accuracy: 1e-9
        )
        XCTAssertEqual(
            BitumMath.varisMaliyetiTon(
                kaynakOrtFiyat: 20_000,
                tasimaMaliyeti: 12_000,
                miktarTon: 0
            ),
            20_000,
            accuracy: 1e-9
        )
    }

    // MARK: - Form sayı/tarih dönüşümleri

    func testTurkceOndalikAyiriciOkunur() {
        XCTAssertEqual(KBNumberFormat.parse("12,5")!, 12.5, accuracy: 1e-9)
        XCTAssertEqual(KBNumberFormat.parse("12.5")!, 12.5, accuracy: 1e-9)
        XCTAssertEqual(KBNumberFormat.parse(" 8 ")!, 8, accuracy: 1e-9)
        XCTAssertNil(KBNumberFormat.parse(""))
        XCTAssertNil(KBNumberFormat.parse("abc"))
        XCTAssertTrue(KBNumberFormat.isInvalid("abc"))
        XCTAssertFalse(KBNumberFormat.isInvalid(""), "boş alan hata değil, gönderilmez")
    }

    func testTamSayiCevrimiOndalikReddeder() {
        XCTAssertEqual(KBNumberFormat.parseInt("2019"), 2019)
        XCTAssertNil(KBNumberFormat.parseInt("2019,5"))
    }

    func testIsoGunSunucuBiciminiKullanir() {
        var bilesenler = DateComponents()
        bilesenler.year = 2026
        bilesenler.month = 3
        bilesenler.day = 5
        bilesenler.hour = 12
        bilesenler.timeZone = TimeZone(identifier: "Europe/Istanbul")
        let tarih = Calendar(identifier: .gregorian).date(from: bilesenler)!

        XCTAssertEqual(tarih.kbIsoGun, "2026-03-05")
    }
}
