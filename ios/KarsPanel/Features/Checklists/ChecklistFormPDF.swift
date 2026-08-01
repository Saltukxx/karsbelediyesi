import CoreGraphics
import Foundation

/// Web `/kontrol-listeleri/[id]/yazdir` sayfasının native karşılığı:
/// kalem × periyot tablosu + not kolonu + üç imza kutusu.
struct ChecklistFormPDF: KBPDFDocument {
    let form: ChecklistDetailDTO

    var fileTitle: String {
        "\(form.sablonAdi) — Periyodik Bakım Kontrol Formu"
    }

    var blocks: [KBPDFBlock] {
        var result: [KBPDFBlock] = [
            .header(
                title: form.sablonAdi,
                subtitle: "Periyodik Bakım Kontrol Formu",
                reference: form.plaka
            ),
            .fields([
                KBPDFField("Plaka", form.plaka),
                KBPDFField("Dönem", form.donem),
                KBPDFField(
                    "Operatör / Teknisyen",
                    form.sorumluOperatorTeknisyen ?? form.operatorAdi
                ),
                KBPDFField("Lokasyon", form.santiyeLokasyon),
            ]),
        ]

        // Kategoriler ayrı tablolara bölünür; web tek tablo kullanır ama kategori
        // başlığı olmadan basılı formda kalemler ayırt edilemiyor.
        for kategori in form.kategoriler {
            result.append(.sectionTitle(kategori.kategori))
            result.append(
                .table(
                    columns: kolonlar,
                    rows: kategori.kalemler.map { satir($0) }
                )
            )
        }

        result.append(.sectionTitle("İMZALAR"))
        result.append(
            .signatures([
                KBPDFSignature(
                    role: "Operatör",
                    name: form.sorumluOperatorTeknisyen ?? form.operatorAdi
                ),
                KBPDFSignature(role: "Teknisyen", name: form.teknisyenAdi),
                KBPDFSignature(
                    role: "Şef / Amir Onayı",
                    name: form.sefAmirAdi ?? form.onaylayanAdi
                ),
            ])
        )
        return result
    }

    private var kolonlar: [KBPDFColumn] {
        // No + kalem + periyotlar + not = 1.0
        let periyotGenisligi = 0.32 / CGFloat(max(form.periyotlar.count, 1))
        return [
            KBPDFColumn(title: "No", width: 0.05, alignment: .center),
            KBPDFColumn(title: "Kontrol Kalemi", width: 0.41),
        ]
            + form.periyotlar.map {
                KBPDFColumn(title: $0.shortName, width: periyotGenisligi, alignment: .center)
            }
            + [KBPDFColumn(title: "Not", width: 0.22)]
    }

    private func satir(_ kalem: ChecklistItemDTO) -> [String] {
        ["\(kalem.siraNo)", kalem.kontrolKalemi]
            + form.periyotlar.map { kalem.sonuc($0)?.degerlendirme?.displayName ?? "" }
            + [kalem.notMetni ?? ""]
    }
}
