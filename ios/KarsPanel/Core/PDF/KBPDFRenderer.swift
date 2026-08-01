import CoreGraphics
import Foundation
import UIKit

/// Web'in `window.print()` sayfalarının native karşılığı. Rapor ekranları
/// yalnızca içerik bloklarını tanımlar; sayfa düzeni, taşma ve sayfalama
/// burada yönetilir.
protocol KBPDFDocument {
    var fileTitle: String { get }
    var blocks: [KBPDFBlock] { get }
}

/// Rapor içeriğinin yapı taşları. Ölçüler A4 üzerinden hesaplanır.
enum KBPDFBlock {
    /// Kurum başlığı + rapor adı + sağ üstte kayıt numarası
    case header(title: String, subtitle: String?, reference: String?)
    case sectionTitle(String)
    /// İki kolona yerleşen etiket–değer çiftleri
    case fields([KBPDFField])
    /// Uzun metin (şikayet açıklaması, çözüm notu)
    case paragraph(label: String?, text: String)
    /// Başlıklı tablo; kolon genişlikleri oransal
    case table(columns: [KBPDFColumn], rows: [[String]])
    /// İmza kutuları (Excel formlarının alt bloğu)
    case signatures([KBPDFSignature])
    case spacer(CGFloat)
}

struct KBPDFField {
    let label: String
    let value: String?

    init(_ label: String, _ value: String?) {
        self.label = label
        self.value = value
    }
}

struct KBPDFColumn {
    let title: String
    /// Toplamı 1.0 olacak şekilde oransal genişlik
    let width: CGFloat
    var alignment: NSTextAlignment = .left
}

struct KBPDFSignature {
    let role: String
    let name: String?
}

/// A4 sayfada dikey akışlı çizim. `UIGraphicsPDFRenderer` kullanır; harici
/// bağımlılık yoktur.
enum KBPDFRenderer {
    private static let pageSize = CGSize(width: 595.2, height: 841.8)
    private static let margin: CGFloat = 36
    private static let lineGap: CGFloat = 4

    private static let titleFont = UIFont.boldSystemFont(ofSize: 16)
    private static let subtitleFont = UIFont.systemFont(ofSize: 10)
    private static let sectionFont = UIFont.boldSystemFont(ofSize: 11)
    private static let labelFont = UIFont.systemFont(ofSize: 8)
    private static let valueFont = UIFont.systemFont(ofSize: 10)
    private static let tableHeadFont = UIFont.boldSystemFont(ofSize: 9)
    private static let tableFont = UIFont.systemFont(ofSize: 9)

    private static let ink = UIColor(red: 0x1e / 255, green: 0x3a / 255, blue: 0x5f / 255, alpha: 1)
    private static let muted = UIColor(red: 0x6b / 255, green: 0x72 / 255, blue: 0x80 / 255, alpha: 1)
    private static let rule = UIColor(red: 0xd6 / 255, green: 0xdd / 255, blue: 0xe6 / 255, alpha: 1)
    private static let zebra = UIColor(red: 0xf4 / 255, green: 0xf6 / 255, blue: 0xf9 / 255, alpha: 1)

    static func render(_ document: KBPDFDocument) -> Data {
        let bounds = CGRect(origin: .zero, size: pageSize)
        let renderer = UIGraphicsPDFRenderer(
            bounds: bounds,
            format: metadata(title: document.fileTitle)
        )

        return renderer.pdfData { context in
            var layout = PageLayout(context: context, bounds: bounds, margin: margin)
            layout.beginPage()
            for block in document.blocks {
                draw(block, in: &layout)
            }
            layout.drawPageNumber()
        }
    }

    /// Dosyayı paylaşım / AirPrint için geçici dizine yazar.
    static func write(_ document: KBPDFDocument, fileName: String) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try render(document).write(to: url, options: .atomic)
        return url
    }

    private static func metadata(title: String) -> UIGraphicsPDFRendererFormat {
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: title,
            kCGPDFContextAuthor as String: "Kars Belediyesi Operasyon Paneli",
        ]
        return format
    }

    // MARK: - Blok çizimi

    private static func draw(_ block: KBPDFBlock, in layout: inout PageLayout) {
        switch block {
        case let .header(title, subtitle, reference):
            drawHeader(title: title, subtitle: subtitle, reference: reference, in: &layout)
        case let .sectionTitle(text):
            layout.ensure(28)
            layout.advance(8)
            layout.draw(text, font: sectionFont, color: ink)
            layout.advance(3)
            layout.drawRule()
            layout.advance(6)
        case let .fields(fields):
            drawFields(fields, in: &layout)
        case let .paragraph(label, text):
            drawParagraph(label: label, text: text, in: &layout)
        case let .table(columns, rows):
            drawTable(columns: columns, rows: rows, in: &layout)
        case let .signatures(signatures):
            drawSignatures(signatures, in: &layout)
        case let .spacer(height):
            layout.advance(height)
        }
    }

    private static func drawHeader(
        title: String,
        subtitle: String?,
        reference: String?,
        in layout: inout PageLayout
    ) {
        layout.draw("KARS BELEDİYESİ", font: subtitleFont, color: muted)
        layout.advance(2)

        if let reference {
            let width = layout.contentWidth
            let referenceWidth = width * 0.3
            layout.drawSideBySide(
                left: (title, titleFont, ink, width - referenceWidth - 8, .left),
                right: (reference, sectionFont, ink, referenceWidth, .right)
            )
        } else {
            layout.draw(title, font: titleFont, color: ink)
        }

        if let subtitle {
            layout.advance(2)
            layout.draw(subtitle, font: subtitleFont, color: muted)
        }
        layout.advance(6)
        layout.drawRule(thickness: 1.2)
        layout.advance(4)
    }

    private static func drawFields(_ fields: [KBPDFField], in layout: inout PageLayout) {
        let columnWidth = (layout.contentWidth - 12) / 2
        var index = 0
        while index < fields.count {
            let left = fields[index]
            let right = index + 1 < fields.count ? fields[index + 1] : nil
            let height = max(
                fieldHeight(left, width: columnWidth),
                right.map { fieldHeight($0, width: columnWidth) } ?? 0
            )
            layout.ensure(height + lineGap)
            let top = layout.cursor
            drawField(left, at: CGPoint(x: layout.left, y: top), width: columnWidth)
            if let right {
                drawField(
                    right,
                    at: CGPoint(x: layout.left + columnWidth + 12, y: top),
                    width: columnWidth
                )
            }
            layout.advance(height + lineGap)
            index += 2
        }
    }

    private static func fieldHeight(_ field: KBPDFField, width: CGFloat) -> CGFloat {
        let labelHeight = labelFont.lineHeight
        let valueHeight = textHeight(
            field.value?.isEmpty == false ? field.value! : "—",
            font: valueFont,
            width: width
        )
        return labelHeight + valueHeight + 2
    }

    private static func drawField(_ field: KBPDFField, at origin: CGPoint, width: CGFloat) {
        field.label.uppercased().draw(
            at: origin,
            font: labelFont,
            color: muted,
            width: width
        )
        let value = field.value?.isEmpty == false ? field.value! : "—"
        value.draw(
            at: CGPoint(x: origin.x, y: origin.y + labelFont.lineHeight + 2),
            font: valueFont,
            color: ink,
            width: width
        )
    }

    private static func drawParagraph(
        label: String?,
        text: String,
        in layout: inout PageLayout
    ) {
        if let label {
            layout.ensure(labelFont.lineHeight + 4)
            layout.draw(label.uppercased(), font: labelFont, color: muted)
            layout.advance(2)
        }
        // Uzun metinler sayfaya sığmazsa satır satır taşınır
        for satir in text.wrapped(font: valueFont, width: layout.contentWidth) {
            layout.ensure(valueFont.lineHeight)
            layout.draw(satir, font: valueFont, color: ink)
        }
        layout.advance(4)
    }

    private static func drawTable(
        columns: [KBPDFColumn],
        rows: [[String]],
        in layout: inout PageLayout
    ) {
        guard !columns.isEmpty else { return }
        let widths = columns.map { $0.width * layout.contentWidth }

        func drawHeaderRow(_ layout: inout PageLayout) {
            let height = tableHeadFont.lineHeight + 6
            layout.ensure(height)
            layout.fill(height: height, color: zebra)
            var x = layout.left
            for (index, column) in columns.enumerated() {
                column.title.draw(
                    at: CGPoint(x: x + 4, y: layout.cursor + 3),
                    font: tableHeadFont,
                    color: ink,
                    width: widths[index] - 8,
                    alignment: column.alignment
                )
                x += widths[index]
            }
            layout.advance(height)
            layout.drawRule()
        }

        drawHeaderRow(&layout)

        for (rowIndex, row) in rows.enumerated() {
            let height = zip(row, widths).reduce(tableFont.lineHeight) { current, pair in
                max(current, textHeight(pair.0, font: tableFont, width: pair.1 - 8))
            } + 6

            // Sayfa sonunda tablo bölünürse yeni sayfada başlık yinelenir
            if !layout.fits(height) {
                layout.newPage()
                drawHeaderRow(&layout)
            }

            if rowIndex.isMultiple(of: 2) == false {
                layout.fill(height: height, color: zebra)
            }
            var x = layout.left
            for (index, column) in columns.enumerated() {
                let value = index < row.count ? row[index] : ""
                value.draw(
                    at: CGPoint(x: x + 4, y: layout.cursor + 3),
                    font: tableFont,
                    color: ink,
                    width: widths[index] - 8,
                    alignment: column.alignment
                )
                x += widths[index]
            }
            layout.advance(height)
            layout.drawRule(color: rule.withAlphaComponent(0.6))
        }
        layout.advance(4)
    }

    private static func drawSignatures(
        _ signatures: [KBPDFSignature],
        in layout: inout PageLayout
    ) {
        guard !signatures.isEmpty else { return }
        let boxHeight: CGFloat = 62
        layout.ensure(boxHeight + 12)
        layout.advance(12)

        let spacing: CGFloat = 10
        let totalSpacing = spacing * CGFloat(signatures.count - 1)
        let width = (layout.contentWidth - totalSpacing) / CGFloat(signatures.count)
        var x = layout.left
        for signature in signatures {
            let box = CGRect(x: x, y: layout.cursor, width: width, height: boxHeight)
            let path = UIBezierPath(roundedRect: box, cornerRadius: 4)
            rule.setStroke()
            path.lineWidth = 0.8
            path.stroke()

            signature.role.uppercased().draw(
                at: CGPoint(x: box.minX + 6, y: box.minY + 6),
                font: labelFont,
                color: muted,
                width: width - 12
            )
            (signature.name ?? "").draw(
                at: CGPoint(x: box.minX + 6, y: box.maxY - valueFont.lineHeight - 6),
                font: valueFont,
                color: ink,
                width: width - 12
            )
            x += width + spacing
        }
        layout.advance(boxHeight)
    }

    // MARK: - Ölçüm

    fileprivate static func textHeight(
        _ text: String,
        font: UIFont,
        width: CGFloat
    ) -> CGFloat {
        guard width > 0 else { return font.lineHeight }
        let bounds = (text as NSString).boundingRect(
            with: CGSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: font],
            context: nil
        )
        return max(font.lineHeight, ceil(bounds.height))
    }
}

/// Dikey akış imleci ve sayfa geçişi.
private struct PageLayout {
    let context: UIGraphicsPDFRendererContext
    let bounds: CGRect
    let margin: CGFloat

    private(set) var cursor: CGFloat = 0
    private(set) var pageIndex = 0

    var left: CGFloat { margin }
    var contentWidth: CGFloat { bounds.width - margin * 2 }
    /// Sayfa numarası için altta yer bırakılır
    private var maxY: CGFloat { bounds.height - margin - 14 }

    mutating func beginPage() {
        context.beginPage()
        pageIndex += 1
        cursor = margin
    }

    mutating func newPage() {
        drawPageNumber()
        beginPage()
    }

    func fits(_ height: CGFloat) -> Bool { cursor + height <= maxY }

    /// Blok sığmıyorsa yeni sayfaya geçer.
    mutating func ensure(_ height: CGFloat) {
        if !fits(height) { newPage() }
    }

    mutating func advance(_ height: CGFloat) {
        cursor += height
    }

    mutating func draw(_ text: String, font: UIFont, color: UIColor) {
        let height = KBPDFRenderer.textHeight(text, font: font, width: contentWidth)
        ensure(height)
        text.draw(
            at: CGPoint(x: left, y: cursor),
            font: font,
            color: color,
            width: contentWidth
        )
        advance(height)
    }

    mutating func drawSideBySide(
        left leftItem: (String, UIFont, UIColor, CGFloat, NSTextAlignment),
        right rightItem: (String, UIFont, UIColor, CGFloat, NSTextAlignment)
    ) {
        let leftHeight = KBPDFRenderer.textHeight(
            leftItem.0,
            font: leftItem.1,
            width: leftItem.3
        )
        let rightHeight = KBPDFRenderer.textHeight(
            rightItem.0,
            font: rightItem.1,
            width: rightItem.3
        )
        let height = max(leftHeight, rightHeight)
        ensure(height)
        leftItem.0.draw(
            at: CGPoint(x: left, y: cursor),
            font: leftItem.1,
            color: leftItem.2,
            width: leftItem.3,
            alignment: leftItem.4
        )
        rightItem.0.draw(
            at: CGPoint(x: bounds.width - margin - rightItem.3, y: cursor),
            font: rightItem.1,
            color: rightItem.2,
            width: rightItem.3,
            alignment: rightItem.4
        )
        advance(height)
    }

    mutating func drawRule(
        thickness: CGFloat = 0.6,
        color: UIColor = UIColor(red: 0xd6 / 255, green: 0xdd / 255, blue: 0xe6 / 255, alpha: 1)
    ) {
        ensure(thickness)
        let path = UIBezierPath()
        path.move(to: CGPoint(x: left, y: cursor))
        path.addLine(to: CGPoint(x: bounds.width - margin, y: cursor))
        color.setStroke()
        path.lineWidth = thickness
        path.stroke()
        advance(thickness)
    }

    func fill(height: CGFloat, color: UIColor) {
        color.setFill()
        UIBezierPath(
            rect: CGRect(x: left, y: cursor, width: contentWidth, height: height)
        ).fill()
    }

    func drawPageNumber() {
        let text = "Sayfa \(pageIndex)"
        let font = UIFont.systemFont(ofSize: 8)
        text.draw(
            at: CGPoint(x: left, y: bounds.height - margin - font.lineHeight),
            font: font,
            color: UIColor(red: 0x6b / 255, green: 0x72 / 255, blue: 0x80 / 255, alpha: 1),
            width: contentWidth,
            alignment: .right
        )
    }
}

private extension String {
    func draw(
        at point: CGPoint,
        font: UIFont,
        color: UIColor,
        width: CGFloat,
        alignment: NSTextAlignment = .left
    ) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = alignment
        paragraph.lineBreakMode = .byWordWrapping
        (self as NSString).draw(
            with: CGRect(x: point.x, y: point.y, width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: font, .foregroundColor: color, .paragraphStyle: paragraph],
            context: nil
        )
    }

    /// Sayfa sonunda bölünebilmesi için metni satırlara ayırır.
    func wrapped(font: UIFont, width: CGFloat) -> [String] {
        var satirlar: [String] = []
        for paragraf in components(separatedBy: .newlines) {
            if paragraf.isEmpty {
                satirlar.append("")
                continue
            }
            var mevcut = ""
            for kelime in paragraf.split(separator: " ", omittingEmptySubsequences: true) {
                let aday = mevcut.isEmpty ? String(kelime) : "\(mevcut) \(kelime)"
                let genislik = (aday as NSString)
                    .size(withAttributes: [.font: font])
                    .width
                if genislik <= width || mevcut.isEmpty {
                    mevcut = aday
                } else {
                    satirlar.append(mevcut)
                    mevcut = String(kelime)
                }
            }
            if !mevcut.isEmpty { satirlar.append(mevcut) }
        }
        return satirlar
    }
}
