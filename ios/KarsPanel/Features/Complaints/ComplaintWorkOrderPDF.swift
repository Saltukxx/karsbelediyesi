import Foundation

/// Web `/sikayetler/[id]/rapor` sayfasının native karşılığı: Excel
/// "RAPORLAMA" bloklarıyla aynı sıra — Şikayet Bilgileri / Konum / Açıklama /
/// Görevlendirme / Onay & İmza.
struct ComplaintWorkOrderPDF: KBPDFDocument {
    let complaint: ComplaintDetailDTO

    var fileTitle: String {
        "Şikayet / İş Emri Raporu \(complaint.sikayetNo ?? complaint.id)"
    }

    var blocks: [KBPDFBlock] {
        [
            .header(
                title: "Şikayet / İş Emri Raporu",
                subtitle: "Saha Operasyon Yönetim Sistemi",
                reference: complaint.sikayetNo
            ),
            .sectionTitle("ŞİKAYET BİLGİLERİ"),
            .fields([
                KBPDFField("Şikayet No", complaint.sikayetNo),
                KBPDFField("Müdürlük", complaint.department?.name),
                KBPDFField("Kayıt Tarihi", complaint.kayitTarihi?.kbGun),
                KBPDFField("Şikayet Türü", complaint.complaintType?.name),
                KBPDFField("Kayıt Saati", complaint.kayitTarihi?.kbSaat),
                KBPDFField("Öncelik", complaint.oncelik?.label),
                KBPDFField("Arayan Kişi", complaint.arayanKisi),
                KBPDFField("Durum", complaint.durum?.label),
                KBPDFField("Telefon", complaint.telefon),
                KBPDFField("Kapanış Tarihi", complaint.kapanisTarihi?.kbGun),
            ]),
            .sectionTitle("KONUM BİLGİLERİ"),
            .fields([
                KBPDFField("Mahalle", complaint.neighborhood?.name),
                KBPDFField("Açık Adres", complaint.acikAdres),
            ]),
            .sectionTitle("ŞİKAYET AÇIKLAMASI"),
            .paragraph(label: nil, text: complaint.aciklama ?? "—"),
            .sectionTitle("GÖREVLENDİRME BİLGİLERİ"),
            .fields([
                KBPDFField("Araç Plakası", complaint.vehicle?.plaka),
                KBPDFField("Görevlendirilen Personel", personelListesi),
                KBPDFField("Şoför Adı", complaint.soforAdi),
                KBPDFField("Müdürlük", complaint.department?.name),
                KBPDFField("Şoför Telefonu", complaint.soforTelefonu),
                KBPDFField("Çözüm Notu", complaint.cozumNotu),
            ]),
            .sectionTitle("ONAY ve İMZA"),
            .signatures([
                KBPDFSignature(role: "Hazırlayan", name: nil),
                KBPDFSignature(role: "Kontrol Eden", name: nil),
                KBPDFSignature(role: "Onaylayan", name: complaint.onaylayanAdi),
            ]),
            .spacer(10),
            .paragraph(
                label: nil,
                text: "Kars Belediyesi · Rapor Tarihi: \(Date().kbGun) · "
                    + "Bu belge Saha Operasyon Yönetim Sistemi tarafından üretilmiştir."
            ),
        ]
    }

    private var personelListesi: String? {
        complaint.personel.isEmpty
            ? nil
            : complaint.personel.map(\.adSoyad).joined(separator: ", ")
    }
}
