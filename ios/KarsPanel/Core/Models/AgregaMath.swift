import Foundation

/// `packages/shared/src/extended-calculations.ts` içindeki agrega maliyet
/// formüllerinin Swift portu. Uygulama parametre değiştikçe anında önizleme
/// gösterir; kayıt sunucuya gidince sunucunun hesabı esas alınır.
/// `KarsPanelTests` web testleriyle aynı beklenen değerleri doğrular.
enum AgregaMath {
    struct FizikselParams {
        var mesafeKm: Double
        var motorinFiyat: Double
        var elektrikFiyat: Double
        var sokumYakitLtSaat: Double
        var sokumAmortisman: Double
        var sokumKapasiteTonSaat: Double
        var yuklemeYakitLtSaat: Double
        var yuklemeAmortisman: Double
        var yuklemeKapasiteTonSaat: Double
        var kamyonKapasiteTon: Double
        var kamyonYakitLtKm: Double
        var seferHizKmSaat: Double
        var yuklemeBosaltmaDk: Double
        var kamyonAmortisman: Double
        var kiriciKw: Double
        var yukFaktoru: Double
        var kiriciKapasiteTonSaat: Double
        var oran05: Double
        var oran512: Double
        var oran1219: Double
        var oran1932: Double
        var donemUretimTon: Double
    }

    struct BoyutMaliyet: Identifiable, Hashable {
        let boyut: String
        let oran: Double
        let tonaj: Double
        let birimMaliyet: Double
        let toplamMaliyet: Double
        var id: String { boyut }
    }

    struct FizikselSonuc {
        let asama1: Double
        let asama2: Double
        let asama3: Double
        let asama4: Double
        let toplamBirim: Double
        let seferMesafe: Double
        let seferYakit: Double
        let seferSure: Double
        let seferToplam: Double
        let boyutlar: [BoyutMaliyet]
        let donemToplamMaliyet: Double
    }

    /// Excel "Maliyet Hesaplama" sayfası: 4 aşamanın ₺/ton maliyeti.
    static func fizikselMaliyet(_ p: FizikselParams) -> FizikselSonuc {
        let asama1 = bol(p.sokumYakitLtSaat * p.motorinFiyat + p.sokumAmortisman,
                         p.sokumKapasiteTonSaat)
        let asama2 = bol(p.yuklemeYakitLtSaat * p.motorinFiyat + p.yuklemeAmortisman,
                         p.yuklemeKapasiteTonSaat)

        let seferMesafe = 2 * p.mesafeKm
        let seferYakit = p.kamyonYakitLtKm * seferMesafe * p.motorinFiyat
        let seferSure = bol(seferMesafe, p.seferHizKmSaat) + p.yuklemeBosaltmaDk / 60
        let seferToplam = seferYakit + p.kamyonAmortisman * seferSure
        let asama3 = bol(seferToplam, p.kamyonKapasiteTon)

        let elektrikMaliyetSaat = p.kiriciKw * p.yukFaktoru * p.elektrikFiyat
        let asama4 = bol(elektrikMaliyetSaat, p.kiriciKapasiteTonSaat)

        let toplamBirim = asama1 + asama2 + asama3 + asama4
        let boyutlar = [
            ("0-5 mm", p.oran05),
            ("5-12 mm", p.oran512),
            ("12-19 mm", p.oran1219),
            ("19-32 mm", p.oran1932),
        ].map { boyut, oran in
            BoyutMaliyet(
                boyut: boyut,
                oran: oran,
                tonaj: p.donemUretimTon * oran,
                birimMaliyet: toplamBirim,
                toplamMaliyet: p.donemUretimTon * oran * toplamBirim
            )
        }

        return FizikselSonuc(
            asama1: asama1,
            asama2: asama2,
            asama3: asama3,
            asama4: asama4,
            toplamBirim: toplamBirim,
            seferMesafe: seferMesafe,
            seferYakit: seferYakit,
            seferSure: seferSure,
            seferToplam: seferToplam,
            boyutlar: boyutlar,
            donemToplamMaliyet: boyutlar.map(\.toplamMaliyet).reduce(0, +)
        )
    }

    struct BoyutSatis: Identifiable, Hashable {
        var boyut: String
        var oran: Double
        var satisFiyati: Double
        var stokHedefi: Double
        var id: String { boyut }
    }

    struct ProjeParams {
        var gunlukHedefTon: Double
        var kiriciYakitTon: Double
        var kiriciBakimTon: Double
        var yukleyiciYakitTon: Double
        var yukleyiciBakimTon: Double
        var nakliyeYakitTon: Double
        var elekElektrikTon: Double
        var elemeBakimTon: Double
        var yikamaSuTon: Double
        var genelGiderTon: Double
        var boyutlar: [BoyutSatis]
    }

    struct ProjeBoyutSonuc: Identifiable, Hashable {
        let boyut: String
        let oran: Double
        let satisFiyati: Double
        let stokHedefi: Double
        let gunlukTon: Double
        let birimMaliyet: Double
        let uretimMaliyetiGun: Double
        let brutKarTon: Double
        let stokMaliyeti: Double
        let stokDegeri: Double
        let potansiyelKar: Double
        var id: String { boyut }
    }

    struct ProjeSonuc {
        let maden: Double
        let nakliye: Double
        let eleme: Double
        let genel: Double
        let birim: Double
        let gunluk: Double
        let boyutDetay: [ProjeBoyutSonuc]
        let agirlikliSatis: Double
        let agirlikliKar: Double
        let toplamStokHedefi: Double
        let toplamStokMaliyeti: Double
        let toplamStokDegeri: Double
        let potansiyelKar: Double
    }

    /// Excel proje modeli: kalem toplamı ₺/ton ve boyut bazlı kâr projeksiyonu.
    static func projeMaliyet(_ p: ProjeParams) -> ProjeSonuc {
        let maden = p.kiriciYakitTon + p.kiriciBakimTon + p.yukleyiciYakitTon
            + p.yukleyiciBakimTon
        let nakliye = p.nakliyeYakitTon
        let eleme = p.elekElektrikTon + p.elemeBakimTon + p.yikamaSuTon
        let genel = p.genelGiderTon
        let birim = maden + nakliye + eleme + genel

        let boyutDetay = p.boyutlar.map { b in
            let gunlukTon = p.gunlukHedefTon * b.oran
            return ProjeBoyutSonuc(
                boyut: b.boyut,
                oran: b.oran,
                satisFiyati: b.satisFiyati,
                stokHedefi: b.stokHedefi,
                gunlukTon: gunlukTon,
                birimMaliyet: birim,
                uretimMaliyetiGun: gunlukTon * birim,
                brutKarTon: b.satisFiyati - birim,
                stokMaliyeti: b.stokHedefi * birim,
                stokDegeri: b.stokHedefi * b.satisFiyati,
                potansiyelKar: b.stokHedefi * (b.satisFiyati - birim)
            )
        }

        // Excel'de olduğu gibi oran toplamı sıfırsa 1 kabul edilir
        let toplamOran = p.boyutlar.map(\.oran).reduce(0, +)
        let agirlikliSatis = p.boyutlar.map { $0.oran * $0.satisFiyati }.reduce(0, +)
            / (toplamOran == 0 ? 1 : toplamOran)

        return ProjeSonuc(
            maden: maden,
            nakliye: nakliye,
            eleme: eleme,
            genel: genel,
            birim: birim,
            gunluk: birim * p.gunlukHedefTon,
            boyutDetay: boyutDetay,
            agirlikliSatis: agirlikliSatis,
            agirlikliKar: agirlikliSatis - birim,
            toplamStokHedefi: boyutDetay.map(\.stokHedefi).reduce(0, +),
            toplamStokMaliyeti: boyutDetay.map(\.stokMaliyeti).reduce(0, +),
            toplamStokDegeri: boyutDetay.map(\.stokDegeri).reduce(0, +),
            potansiyelKar: boyutDetay.map(\.potansiyelKar).reduce(0, +)
        )
    }

    /// Aşamanın toplam birim maliyet içindeki payı (Excel Özet Rapor).
    static func asamaPayi(asamaBirim: Double, toplamBirim: Double) -> Double {
        toplamBirim <= 0 ? 0 : asamaBirim / toplamBirim
    }

    static func yillikUretim(gunlukHedefTon: Double, yillikCalismaGun: Double) -> Double {
        gunlukHedefTon * yillikCalismaGun
    }

    static func aylikMaliyet(gunlukMaliyet: Double, yillikCalismaGun: Double) -> Double {
        gunlukMaliyet * (yillikCalismaGun / 12)
    }

    static func yillikMaliyet(gunlukMaliyet: Double, yillikCalismaGun: Double) -> Double {
        gunlukMaliyet * yillikCalismaGun
    }

    static func stokPayi(stokHedefi: Double, toplamStokHedefi: Double) -> Double {
        toplamStokHedefi <= 0 ? 0 : stokHedefi / toplamStokHedefi
    }

    /// JS `x/0` sonsuz döner; Swift'te de aynıdır ama görüntülemede 0 tercih edilir.
    private static func bol(_ pay: Double, _ bolen: Double) -> Double {
        bolen == 0 ? 0 : pay / bolen
    }
}

extension AgregaMath.FizikselParams {
    /// Sunucudan gelen parametreleri hesap girdisine çevirir.
    init(dto: AgregaParamsDTO) {
        self.init(
            mesafeKm: dto.mesafeKm,
            motorinFiyat: dto.motorinFiyat,
            elektrikFiyat: dto.elektrikFiyat,
            sokumYakitLtSaat: dto.sokumYakitLtSaat,
            sokumAmortisman: dto.sokumAmortisman,
            sokumKapasiteTonSaat: dto.sokumKapasiteTonSaat,
            yuklemeYakitLtSaat: dto.yuklemeYakitLtSaat,
            yuklemeAmortisman: dto.yuklemeAmortisman,
            yuklemeKapasiteTonSaat: dto.yuklemeKapasiteTonSaat,
            kamyonKapasiteTon: dto.kamyonKapasiteTon,
            kamyonYakitLtKm: dto.kamyonYakitLtKm,
            seferHizKmSaat: dto.seferHizKmSaat,
            yuklemeBosaltmaDk: dto.yuklemeBosaltmaDk,
            kamyonAmortisman: dto.kamyonAmortisman,
            kiriciKw: dto.kiriciKw,
            yukFaktoru: dto.yukFaktoru,
            kiriciKapasiteTonSaat: dto.kiriciKapasiteTonSaat,
            oran05: dto.oran05,
            oran512: dto.oran512,
            oran1219: dto.oran1219,
            oran1932: dto.oran1932,
            donemUretimTon: dto.donemUretimTon
        )
    }
}

extension AgregaMath.ProjeParams {
    init(dto: AgregaParamsDTO, boyutlar: [AgregaBoyutSatisDTO]) {
        self.init(
            gunlukHedefTon: dto.gunlukHedefTon,
            kiriciYakitTon: dto.kiriciYakitTon,
            kiriciBakimTon: dto.kiriciBakimTon,
            yukleyiciYakitTon: dto.yukleyiciYakitTon,
            yukleyiciBakimTon: dto.yukleyiciBakimTon,
            nakliyeYakitTon: dto.nakliyeYakitTon,
            elekElektrikTon: dto.elekElektrikTon,
            elemeBakimTon: dto.elemeBakimTon,
            yikamaSuTon: dto.yikamaSuTon,
            genelGiderTon: dto.genelGiderTon,
            boyutlar: boyutlar.map {
                AgregaMath.BoyutSatis(
                    boyut: $0.boyut,
                    oran: $0.oran,
                    satisFiyati: $0.satisFiyati,
                    stokHedefi: $0.stokHedefi
                )
            }
        )
    }
}
