import Foundation

/// Bildirimlerin ve push yüklerinin taşıdığı web yolunu (`href`) native hedefe
/// çevirir. Sunucu tek bir `href` üretir; web onu router'a, uygulama buraya verir.
///
/// Çözülemeyen yollar `nil` döner — bilinmeyen bir bildirim kullanıcıyı yanlış
/// ekrana atmaktansa yerinde bırakır.
struct KBDeepLink: Hashable {
    /// Açılacak modül (tab / sidebar seçimi)
    let destination: NavDestination
    /// Modülün üstüne itilecek detay ekranı (yoksa modülün kendisi açılır)
    let route: PanelRoute?

    init(destination: NavDestination, route: PanelRoute? = nil) {
        self.destination = destination
        self.route = route
    }

    init?(href: String) {
        let parcalar = Self.parcalar(href)
        guard let kok = parcalar.first else {
            self.init(destination: .dashboard)
            return
        }

        let kimlik = parcalar.count > 1 ? parcalar[1] : nil
        switch (kok, kimlik) {
        case let ("sikayetler", .some(id)) where id != "yeni":
            self.init(destination: .sikayetler, route: .complaint(id))
        case let ("islerim", .some(id)):
            self.init(destination: .islerim, route: .workItemComplaint(id))
        case let ("kontrol-listeleri", .some(id)) where id != "yeni":
            self.init(destination: .kontrol, route: .checklist(id))
        case let ("gorevler", .some(id)) where id != "yeni":
            // `/gorevler/[id]/takip` doğrudan analiz raporunu açar
            let takip = parcalar.count > 2 && parcalar[2] == "takip"
            self.init(destination: .gorevler, route: takip ? .taskTrack(id) : .task(id))
        case let ("araclar", .some(id)) where id != "yeni":
            self.init(destination: .araclar, route: .vehicle(id))
        case let ("personel", .some(id)) where id != "yeni":
            self.init(destination: .personel, route: .personnel(id))
        default:
            // Detaysız modül yolları nav kataloğundan çözülür
            guard let hedef = NavDestination.allCases.first(where: {
                $0.webPath == "/\(kok)"
            }) else { return nil }
            self.init(destination: hedef)
        }
    }

    /// Yolu sorgu/çapa ekleri ve baştaki host'tan arındırıp bileşenlere ayırır.
    private static func parcalar(_ href: String) -> [String] {
        var yol = href
        if let url = URL(string: href), url.host != nil {
            yol = url.path
        }
        yol = yol.components(separatedBy: CharacterSet(charactersIn: "?#"))[0]
        return yol.split(separator: "/").map(String.init)
    }
}
