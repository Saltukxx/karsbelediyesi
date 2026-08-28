import Foundation

// MARK: - Grafiklerin çizim modelleri

struct ChartSlice: Identifiable, Equatable {
    let name: String
    let value: Int

    var id: String { name }
}

struct ChartTrendPoint: Identifiable, Equatable {
    let date: Date
    let acilan: Int
    let kapanan: Int

    var id: Date { date }
}

struct ChartDepartmentBar: Identifiable, Equatable {
    let name: String
    let acik: Int
    let devam: Int
    let kapatildi: Int

    var id: String { name }
    var toplam: Int { acik + devam + kapatildi }
}

struct ChartDepartmentSegment: Identifiable, Equatable {
    let department: String
    let durum: String
    let value: Int

    var id: String { "\(department)-\(durum)" }
}

struct ChartCostPoint: Identifiable, Equatable {
    let ayKey: String
    let label: String
    let bakim: Double
    let yakit: Double

    var id: String { ayKey }
    var toplam: Double { bakim + yakit }
}

struct ChartHeatCell: Identifiable, Equatable {
    let haftaGunu: Int
    let saat: Int
    let adet: Int

    var id: String { "\(haftaGunu)-\(saat)" }
}

struct ChartSlaSegment: Identifiable, Equatable {
    let name: String
    let value: Int

    var id: String { name }
}

// MARK: - Dönüşümler

/// Grafiklerin ihtiyaç duyduğu tüm veri dönüşümleri. UI'dan bağımsız tutulur ki
/// ilk N + "Diğer" gruplaması, ısı matrisi doldurma gibi kurallar test edilebilsin.
enum DashboardChartData {
    static let haftaGunleri = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

    static let aracDurumlari: [(key: String, label: String)] = [
        ("MUSAIT", "Müsait"),
        ("GOREVDE", "Görevde"),
        ("BAKIMDA", "Bakımda"),
        ("ARIZALI", "Arızalı"),
        ("PLANLI_BAKIM", "Planlı bakım"),
    ]

    // MARK: Trend

    static func trend(from dto: [DashboardTrendPointDTO]) -> [ChartTrendPoint] {
        dto.compactMap { point in
            guard let date = KBChartFormat.gunTarihi(point.gun) else { return nil }
            return ChartTrendPoint(date: date, acilan: point.acilan, kapanan: point.kapanan)
        }
        .sorted { $0.date < $1.date }
    }

    /// Web'deki `markLine: average` karşılığı — "bugün normalin üstünde mi" sorusunu cevaplar.
    static func ortalamaAcilan(_ points: [ChartTrendPoint]) -> Double {
        guard !points.isEmpty else { return 0 }
        let toplam = points.reduce(0) { $0 + $1.acilan }
        return Double(toplam) / Double(points.count)
    }

    static func trendBos(_ points: [ChartTrendPoint]) -> Bool {
        points.allSatisfy { $0.acilan == 0 && $0.kapanan == 0 }
    }

    // MARK: Müdürlük

    static func departments(
        from dto: [DashboardMudurlukDTO],
        limit: Int = 8
    ) -> [ChartDepartmentBar] {
        dto.prefix(limit).map { item in
            // Eski payload durum kırılımı taşımayabilir; toplam tek kovaya düşer.
            let acik = item.acik ?? item.toplam
            let devam = item.devam ?? 0
            let kapatildi = item.kapatildi ?? 0
            return ChartDepartmentBar(
                name: item.name,
                acik: acik,
                devam: devam,
                kapatildi: kapatildi
            )
        }
    }

    /// Stacked bar için düzleştirilmiş segmentler; sıfır değerler çizilmez.
    static func departmentSegments(_ bars: [ChartDepartmentBar]) -> [ChartDepartmentSegment] {
        bars.flatMap { bar -> [ChartDepartmentSegment] in
            [
                ChartDepartmentSegment(department: bar.name, durum: "Açık", value: bar.acik),
                ChartDepartmentSegment(department: bar.name, durum: "Devam eden", value: bar.devam),
                ChartDepartmentSegment(department: bar.name, durum: "Kapatıldı", value: bar.kapatildi),
            ]
            .filter { $0.value > 0 }
        }
    }

    // MARK: Dilimler

    /// İlk `limit` dilimi bırakır, kalanını tek "Diğer" diliminde toplar.
    ///
    /// Şikayet türleri arasında zaten "Diğer" adlı bir kayıt olabilir; bu durumda
    /// yeni bir dilim eklenmez, artık mevcut dilime eklenir. Aksi halde listede
    /// aynı adla iki satır belirir.
    static func topSlices(
        _ slices: [ChartSlice],
        limit: Int = 7,
        otherLabel: String = "Diğer"
    ) -> [ChartSlice] {
        let dolu = slices.filter { $0.value > 0 }
        guard dolu.count > limit else { return dolu }

        var ilk = Array(dolu.prefix(limit))
        let kalan = dolu.dropFirst(limit).reduce(0) { $0 + $1.value }
        guard kalan > 0 else { return ilk }

        if let index = ilk.firstIndex(where: { $0.name == otherLabel }) {
            ilk[index] = ChartSlice(name: otherLabel, value: ilk[index].value + kalan)
            return ilk
        }
        return ilk + [ChartSlice(name: otherLabel, value: kalan)]
    }

    static func types(from dto: [DashboardTurDTO], limit: Int = 7) -> [ChartSlice] {
        topSlices(dto.map { ChartSlice(name: $0.name, value: $0.toplam) }, limit: limit)
    }

    static func channels(from dto: [DashboardKanalDTO]) -> [ChartSlice] {
        dto.compactMap { item in
            let value = item.toplam
            guard value > 0 else { return nil }
            return ChartSlice(name: kanalEtiketi(item.kanal), value: value)
        }
    }

    static func kanalEtiketi(_ raw: String) -> String {
        switch raw {
        case "TELEFON": return "Telefon"
        case "WHATSAPP": return "WhatsApp"
        case "WEB": return "Web"
        default: return raw
        }
    }

    /// Araç dilimleri sabit sırayı korur; boş durumlar donut'a girmez.
    static func vehicles(from map: [String: Int]) -> [ChartSlice] {
        aracDurumlari.compactMap { item in
            let value = map[item.key] ?? 0
            guard value > 0 else { return nil }
            return ChartSlice(name: item.label, value: value)
        }
    }

    static func vehicleKey(forLabel label: String) -> String {
        aracDurumlari.first { $0.label == label }?.key ?? label
    }

    /// "Fen İşleri Müdürlüğü" → "Fen İşleri". Telefonda her satır tek satıra
    /// sığsın diye tüm adlarda tekrarlayan sonek atılır.
    static func kisaMudurluk(_ name: String) -> String {
        sonekiAt(name, suffix: " Müdürlüğü")
    }

    /// "Atatürk Mahallesi" → "Atatürk"
    static func kisaMahalle(_ name: String) -> String {
        sonekiAt(name, suffix: " Mahallesi")
    }

    private static func sonekiAt(_ name: String, suffix: String) -> String {
        guard name.hasSuffix(suffix) else { return name }
        let kisa = String(name.dropLast(suffix.count))
        return kisa.isEmpty ? name : kisa
    }

    static func neighborhoods(
        from dto: [DashboardMahalleDTO],
        limit: Int = 10
    ) -> [ChartSlice] {
        dto.prefix(limit)
            .map { ChartSlice(name: $0.name, value: $0.toplam) }
            .filter { $0.value > 0 }
    }

    /// `chartAngleSelection` kümülatif açı değeri döndürür; hangi dilime denk
    /// geldiğini bulmak çağıranın işi.
    static func sliceIndex(forAngleValue value: Int?, in slices: [ChartSlice]) -> Int? {
        guard let value, value >= 0 else { return nil }
        var toplam = 0
        for (index, slice) in slices.enumerated() {
            toplam += slice.value
            if value < toplam { return index }
        }
        return nil
    }

    // MARK: SLA

    static func slaSegments(from sla: DashboardSlaDTO) -> [ChartSlaSegment] {
        [
            ChartSlaSegment(name: "24 saatten az", value: sla.bucketLt24h),
            ChartSlaSegment(name: "1–3 gün", value: sla.bucket1to3d),
            ChartSlaSegment(name: "3 günden fazla", value: sla.bucketGt3d),
        ]
    }

    // MARK: Isı matrisi

    /// API yalnız dolu hücreleri gönderir; ısı haritası 7x24'ün tamamını ister.
    static func heatMatrix(from dto: [DashboardSaatlikDTO]) -> [ChartHeatCell] {
        var lookup: [Int: Int] = [:]
        for cell in dto where (1...7).contains(cell.haftaGunu) && (0...23).contains(cell.saat) {
            lookup[cell.haftaGunu * 100 + cell.saat, default: 0] += cell.adet
        }
        return (1...7).flatMap { gun in
            (0...23).map { saat in
                ChartHeatCell(haftaGunu: gun, saat: saat, adet: lookup[gun * 100 + saat] ?? 0)
            }
        }
    }

    static func heatMax(_ cells: [ChartHeatCell]) -> Int {
        max(cells.map(\.adet).max() ?? 0, 1)
    }

    static func gunEtiketi(_ haftaGunu: Int) -> String {
        guard (1...7).contains(haftaGunu) else { return "?" }
        return haftaGunleri[haftaGunu - 1]
    }

    static func saatEtiketi(_ saat: Int) -> String {
        String(format: "%02d", saat)
    }

    // MARK: Maliyet

    static func cost(from dto: [DashboardMaliyetPointDTO]) -> [ChartCostPoint] {
        dto.map { item in
            ChartCostPoint(
                ayKey: item.ay,
                label: KBChartFormat.ayEtiketi(item.ay),
                bakim: item.bakim,
                yakit: item.yakit
            )
        }
    }
}
