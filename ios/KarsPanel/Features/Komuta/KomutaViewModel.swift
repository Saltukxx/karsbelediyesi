import SwiftUI
import UIKit

@MainActor
final class KomutaViewModel: ObservableObject {
    @Published private(set) var veri: KomutaVeriDTO?
    @Published private(set) var isLoading = false
    @Published private(set) var islemYapiliyor = false
    @Published var errorMessage: String?
    @Published var bilgiMesaji: String?
    @Published private(set) var odak: KBMapFocus?

    private let api: APIClient
    private let poller = KBPoller(channel: .komuta)
    /// Aynı hedefe tekrar dokunmak kadrajı yeniden kursun diye artan sayaç
    private var odakSayaci = 0

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - Türetilmiş veri

    var araclar: [KomutaAracDTO] { veri?.araclar ?? [] }
    var bekleyenler: [KomutaBekleyenDTO] { veri?.bekleyenler ?? [] }
    var gecikenRotalar: [KomutaGecikenRotaDTO] { veri?.gecikenRotalar ?? [] }
    var filo: KomutaFiloOzeti { KomutaFiloOzeti(araclar: araclar) }

    /// Web'le aynı ölçüt: 24 saatten eski açık şikayetler geciken sayılır.
    var gecikenSikayetler: [KomutaSikayetPinDTO] {
        (veri?.sikayetler ?? []).filter(\.bucket.gecikmis)
    }

    var gecikenIsSayisi: Int { gecikenRotalar.count + gecikenSikayetler.count }

    var konumluAraclar: [KomutaAracDTO] { araclar.filter { $0.koordinat != nil } }

    var canliMi: Bool { veri != nil && errorMessage == nil }

    var durumMetni: String {
        if let bilgiMesaji { return bilgiMesaji }
        guard let veri else { return "Veri bekleniyor…" }
        return "Son güncelleme \(veri.zaman.kbSaat) · \(Int(KBPollingChannel.komuta.interval)) sn'de bir yenilenir"
    }

    var kpiKartlari: [KBStat] {
        guard let kpi = veri?.kpi else { return [] }
        return [
            KBStat(
                label: "Açık şikayet",
                value: String(kpi.acikSikayet),
                tone: kpi.slaGt3 > 0 ? .danger : .neutral
            ),
            KBStat(
                label: "3 günden eski",
                value: String(kpi.slaGt3),
                tone: kpi.slaGt3 > 0 ? .danger : .success
            ),
            KBStat(
                label: "Bekleyen atama",
                value: String(kpi.bekleyenAtama),
                tone: kpi.bekleyenAtama > 0 ? .warning : .neutral
            ),
            KBStat(
                label: "Geciken rota",
                value: String(kpi.gecikenRota),
                tone: kpi.gecikenRota > 0 ? .danger : .success
            ),
            KBStat(label: "Devam eden görev", value: String(kpi.devamEdenGorev), tone: .info),
            KBStat(
                label: "Canlı araç",
                value: "\(kpi.tazeKonumluArac) / \(kpi.toplamArac)",
                tone: kpi.tazeKonumluArac > 0 ? .success : .neutral
            ),
            KBStat(label: "Bugünkü operasyon", value: String(kpi.bugunOperasyon), tone: .info),
        ]
    }

    /// Geciken rotalar haritada kendi renkleriyle çizilir; rotada olmayan
    /// araçlar ve eski şikayetler kırmızıya kayar.
    var polylines: [KBMapPolyline] {
        gecikenRotalar.map { rota in
            KBMapPolyline(
                id: rota.listeId,
                coordinates: KBGeo.coordinates(rota.koordinatlar),
                style: rota.tip == .KIS ? .kis : .cop
            )
        }
    }

    var pins: [KBMapPin] {
        let aracPinleri = konumluAraclar.compactMap { arac -> KBMapPin? in
            guard let koordinat = arac.koordinat else { return nil }
            return KBMapPin(
                id: "arac-\(arac.id)",
                coordinate: koordinat,
                kind: .arac,
                title: arac.plaka,
                subtitle: [arac.aktifGorev?.gorevNo ?? "boşta", arac.rotaDurumu]
                    .compactMap { $0 }
                    .joined(separator: " · "),
                tint: aracRengi(arac)
            )
        }
        let sikayetPinleri = (veri?.sikayetler ?? []).map { sikayet in
            KBMapPin(
                id: "sikayet-\(sikayet.id)",
                coordinate: sikayet.koordinat,
                kind: .sikayet,
                title: sikayet.sikayetNo,
                subtitle: sikayet.bucket.displayName,
                tint: sikayet.bucket.badgeTone.uiColor
            )
        }
        return aracPinleri + sikayetPinleri
    }

    /// Kadraj yalnızca veri kümesi büyüyüp küçüldüğünde kurulur; her 30 sn'lik
    /// yenilemede haritayı zıplatmaz.
    var kadrajAnahtari: String {
        "komuta-\(araclar.count)-\(gecikenRotalar.count)"
    }

    func aracTonu(_ arac: KomutaAracDTO) -> StatusBadge.Tone {
        if arac.rotada == false { return .danger }
        if !arac.taze { return .neutral }
        return arac.aktifGorev == nil ? .success : .info
    }

    private func aracRengi(_ arac: KomutaAracDTO) -> UIColor {
        if arac.rotada == false { return .systemRed }
        if !arac.taze { return .systemGray }
        return arac.aktifGorev == nil ? .systemGreen : .systemBlue
    }

    // MARK: - Odak

    func rotayaOdakla(_ rota: KomutaGecikenRotaDTO) {
        odakla(KBGeo.coordinates(rota.koordinatlar))
    }

    func noktayaOdakla(_ koordinat: KBCoordinate) {
        odakla([koordinat])
    }

    func pinSecildi(_ pinId: String) {
        guard let arac = araclar.first(where: { "arac-\($0.id)" == pinId }),
              let koordinat = arac.koordinat
        else { return }
        odakla([koordinat])
    }

    private func odakla(_ noktalar: [KBCoordinate]) {
        guard !noktalar.isEmpty else { return }
        odakSayaci += 1
        odak = KBMapFocus(coordinates: noktalar, nonce: odakSayaci)
    }

    // MARK: - Yükleme

    func load() async {
        if veri == nil { isLoading = true }
        do {
            veri = try await api.fetchKomuta()
            errorMessage = nil
        } catch {
            // Elde eski veri varsa ekranda tutulur; hata banner'la bildirilir.
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    func pollingBaslat(phase: KBAppPhase) {
        poller.sync(phase: phase, ekranGorunur: true) { [weak self] in
            // Atama/tarama sonucu bir sonraki turda yerini canlı duruma bırakır
            self?.bilgiMesaji = nil
            await self?.load()
        }
    }

    func pollingDurdur() {
        poller.stop()
    }

    // MARK: - Sevkiyat kararları

    func ata(_ oneri: KomutaBekleyenDTO) async {
        await islem {
            let sonuc = try await self.api.acceptDispatch(jobId: oneri.jobId)
            self.bilgiMesaji = "Görev açıldı: \(sonuc.gorevNo)"
        }
    }

    func reddet(_ oneri: KomutaBekleyenDTO) async {
        await islem {
            try await self.api.rejectDispatch(jobId: oneri.jobId)
            self.bilgiMesaji = "\(oneri.routeAd) önerisi reddedildi"
        }
    }

    func slaTaramasi() async {
        await islem {
            let sonuc = try await self.api.runSlaScan()
            self.bilgiMesaji = sonuc.ozet
        }
    }

    /// Öneri başka bir kullanıcı tarafından sonuçlandırıldıysa sunucu 409 döner;
    /// veri her durumda tazelenir ki liste gerçek durumu göstersin.
    private func islem(_ eylem: @escaping () async throws -> Void) async {
        islemYapiliyor = true
        errorMessage = nil
        bilgiMesaji = nil
        do {
            try await eylem()
        } catch {
            errorMessage = APIError.describe(error)
        }
        islemYapiliyor = false
        await load()
    }
}

private extension StatusBadgeTone {
    /// Harita işaretleri UIKit rengi ister; rozet tonlarıyla aynı anlam.
    var uiColor: UIColor {
        switch self {
        case .neutral: return .systemGray
        case .success: return .systemGreen
        case .warning: return .systemOrange
        case .danger: return .systemRed
        case .info: return .systemBlue
        case .accent: return .systemIndigo
        }
    }
}
