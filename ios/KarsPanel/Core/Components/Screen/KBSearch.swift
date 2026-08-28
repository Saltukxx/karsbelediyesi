import Foundation

/// Liste ekranlarının ortak metin arama karşılaştırması.
enum KBSearch {
    /// `lowercased()` Türkçe metinde yanlış eşleşiyor: "İVECO" küçültülünce noktası ayrı
    /// bir birleşim işaretine dönüşüyor ve "iveco" sorgusuna takılmıyor. Yerelleştirilmiş
    /// karşılaştırma büyük/küçük harf ile aksanı birlikte yok sayar, ayrıca her alan için
    /// yeni bir küçük harfli kopya üretmez.
    static func eslesir(_ alan: String?, _ sorgu: String) -> Bool {
        guard let alan, !alan.isEmpty else { return false }
        return alan.localizedStandardContains(sorgu)
    }

    static func eslesir(_ alanlar: [String?], _ sorgu: String) -> Bool {
        alanlar.contains { eslesir($0, sorgu) }
    }
}
