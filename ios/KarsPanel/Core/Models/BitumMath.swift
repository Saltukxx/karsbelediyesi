import Foundation

/// `packages/shared/src/extended-calculations.ts` bitüm formüllerinin Swift portu.
/// Form önizlemesi içindir; kayıt sunucuda yeniden hesaplanır.
enum BitumMath {
    /// Gidiş-dönüş yakıt maliyeti.
    static func seferMaliyeti(mesafeKm: Double, yakitTlKm: Double) -> Double {
        mesafeKm * 2 * yakitTlKm
    }

    static func tonTasima(seferTl: Double, tirKapasiteTon: Double) -> Double {
        tirKapasiteTon <= 0 ? 0 : seferTl / tirKapasiteTon
    }

    /// Excel CEILING: kısmi yük de tam sefer sayılır.
    static func tirSefer(miktarTon: Double, tirKapasiteTon: Double) -> Int {
        guard tirKapasiteTon > 0 else { return 0 }
        return Int((miktarTon / tirKapasiteTon).rounded(.up))
    }

    static func doluluk(stok: Double, kapasite: Double) -> Double {
        kapasite <= 0 ? 0 : stok / kapasite
    }

    static func depoDurumu(
        doluluk: Double,
        kritikEsik: Double,
        dusukEsik: Double
    ) -> String {
        if doluluk <= kritikEsik { return "KRITIK" }
        if doluluk <= dusukEsik { return "DUSUK" }
        return "NORMAL"
    }

    static func alisMaliyeti(miktarTon: Double, fiyatTon: Double) -> Double {
        miktarTon * fiyatTon
    }

    /// Excel L: varış maliyeti/ton = kaynak ortalama fiyat + taşıma/miktar.
    static func varisMaliyetiTon(
        kaynakOrtFiyat: Double,
        tasimaMaliyeti: Double,
        miktarTon: Double
    ) -> Double {
        miktarTon <= 0 ? kaynakOrtFiyat : kaynakOrtFiyat + tasimaMaliyeti / miktarTon
    }
}
