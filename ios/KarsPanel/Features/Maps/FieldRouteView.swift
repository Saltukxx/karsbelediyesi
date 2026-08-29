import MapKit
import SwiftUI

/// Kış operasyonu, çöp toplama ve yol temizliği rotalarının ortak ekranı.
struct FieldRouteView: View {
    let kind: String
    let title: String
    var subtitle: String? = nil

    @State private var rotalar: [FieldRouteDTO] = []
    @State private var cizim: [CLLocationCoordinate2D] = []
    @State private var secili: FieldRouteDTO?
    @State private var adaylar: [DispatchCandidateDTO] = []
    @State private var hata: String?
    @State private var toast: String?
    @State private var showKaydet = false
    @State private var kaydediliyor = false
    @State private var yukleniyor = false
    /// Rota listesi opsiyonel olmadığı için "henüz yüklenmedi" ile "boş geldi"
    /// ayrımı buradan yapılır; yükleniyor göstergesi yalnızca ilkinde çıkar.
    @State private var ilkYuklemeBitti = false

    var body: some View {
        VStack(spacing: 0) {
            KBMapHeader(title: title, subtitle: subtitle)

            // Harita temsilcisi yığında esnek alanı tümüyle yuttuğu için panel yan yana
            // değil üstüne bindirilir; böylece kendi boyunda kalır.
            ZStack(alignment: .top) {
                KarsMapView(
                    polylines: polylines,
                    onTap: { cizim.append($0) }
                )
                if let hata {
                    ErrorBanner(message: hata).padding(12)
                }
            }
            .overlay(alignment: .bottom) {
                altPanel.safeAreaPadding(.bottom)
            }
        }
        .overlay {
            if yukleniyor && !ilkYuklemeBitti { LoadingOverlay() }
        }
        .kbNavigationChrome(title: title)
        .kbToast($toast)
        .task { await yukle() }
        .sheet(isPresented: $showKaydet) {
            FieldRouteSaveSheet(
                title: title,
                noktaSayisi: cizim.count,
                isSubmitting: kaydediliyor,
                errorMessage: hata,
                onSubmit: { ad in Task { await rotaKaydet(ad) } },
                onCancel: { showKaydet = false }
            )
        }
    }

    private var altPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Text(cizim.isEmpty
                    ? "\(rotalar.count) rota tanımlı."
                    : "\(cizim.count) nokta çizildi.")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
                Spacer(minLength: 8)
                if !cizim.isEmpty {
                    Button("Temizle") { cizim = [] }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KBTheme.danger)
                }
                Button("Rota Kaydet") { showKaydet = true }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(cizim.count >= 2 ? .white : KBTheme.muted)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 32)
                    .background(cizim.count >= 2 ? KBTheme.action : KBTheme.border)
                    .clipShape(Capsule())
                    .disabled(cizim.count < 2)
            }

            // Panel haritanın üstünde durduğu için boşken tam boy kart yerine tek
            // satırlık ipucu gösterilir ve liste alanı hiç yer kaplamaz.
            if rotalar.isEmpty && adaylar.isEmpty {
                Text("Henüz rota yok. Haritaya dokunarak ilk rotayı çizebilirsiniz.")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        KBSectionHeader(title: "Rotalar", trailing: "\(rotalar.count) kayıt")
                        ForEach(rotalar) { rota in
                            KBRecordCard(
                                title: rota.ad ?? rota.id,
                                badges: secili?.id == rota.id ? [KBBadge(text: "Seçili", tone: .accent)] : [],
                                subtitle: rota.notlar,
                                meta: meta(rota),
                                actions: [
                                    KBRecordAction(
                                        id: "\(rota.id)-aday",
                                        title: "Aday Araçlar",
                                        icon: "car.2",
                                        kind: .primary
                                    ) {
                                        secili = rota
                                        Task { await adaylariYukle(rota) }
                                    },
                                ],
                                accent: secili?.id == rota.id ? KBTheme.accent : KBTheme.navy
                            )
                        }

                        if !adaylar.isEmpty {
                            KBSectionHeader(title: "Aday araçlar", trailing: secili?.ad)
                            ForEach(adaylar) { aday in
                                KBRecordCard(
                                    title: aday.plaka ?? aday.vehicleId,
                                    badges: [KBBadge(text: "Skor \(Int(aday.skor ?? 0))", tone: .info)],
                                    meta: adayMeta(aday),
                                    actions: [
                                        KBRecordAction(
                                            id: "\(aday.vehicleId)-ata",
                                            title: "Ata",
                                            icon: "checkmark",
                                            kind: .primary
                                        ) {
                                            Task { await ata(aday) }
                                        },
                                    ],
                                    accent: KBTheme.info
                                )
                            }
                        }
                    }
                    .padding(.bottom, 8)
                }
                // Kısa listede boş alan bırakmasın diye önce içeriğine göre ölçülür,
                // sonra taşarsa 240'ta sınırlanıp kaydırılır.
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxHeight: 240)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(KBTheme.card)
        .overlay(alignment: .top) {
            Rectangle().fill(KBTheme.border).frame(height: 1)
        }
    }

    private func meta(_ rota: FieldRouteDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let nokta = rota.koordinatlar?.count {
            chips.append(KBMetaChip(icon: "mappin", text: "\(nokta) nokta"))
        }
        if let oncelik = rota.oncelik {
            chips.append(KBMetaChip(icon: "flag", text: "Öncelik \(oncelik)"))
        }
        if let gunler = rota.gunler, !gunler.isEmpty {
            chips.append(KBMetaChip(icon: "calendar", text: gunler.map(Self.gunAdi).joined(separator: ", ")))
        }
        return chips
    }

    private func adayMeta(_ aday: DispatchCandidateDTO) -> [KBMetaChip] {
        var chips: [KBMetaChip] = []
        if let mesafe = KBFormat.sayi(aday.mesafeKm, birim: "km") {
            chips.append(KBMetaChip(icon: "arrow.triangle.swap", text: mesafe))
        }
        if let sure = KBFormat.sayi(aday.sureDk, birim: "dk") {
            chips.append(KBMetaChip(icon: "clock", text: sure))
        }
        return chips
    }

    private static func gunAdi(_ gun: Int) -> String {
        let adlar = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
        guard gun >= 1, gun <= adlar.count else { return "\(gun)" }
        return adlar[gun - 1]
    }

    private var polylines: [MapPolylineLayer] {
        var result = rotalar.map {
            MapPolylineLayer(id: $0.id, coordinates: coordsFromPairs($0.koordinatlar))
        }
        if cizim.count >= 2 {
            result.append(MapPolylineLayer(id: "draft", coordinates: cizim))
        }
        return result
    }

    private func yukle() async {
        yukleniyor = true
        defer { yukleniyor = false }
        do {
            rotalar = try await APIClient.shared.fetchFieldRoutes(kind: kind)
            hata = nil
            ilkYuklemeBitti = true
        } catch is CancellationError {
            return
        } catch {
            hata = KBErrorText.of(error)
        }
    }

    private func rotaKaydet(_ ad: String) async {
        kaydediliyor = true
        defer { kaydediliyor = false }
        do {
            try await APIClient.shared.saveFieldRoute(
                kind: kind,
                ad: ad,
                coords: cizim.map { [$0.latitude, $0.longitude] },
                gunler: kind == "cop" ? [1, 2, 3, 4, 5] : nil
            )
            cizim = []
            showKaydet = false
            toast = "Rota kaydedildi"
            hata = nil
            await yukle()
        } catch {
            hata = KBErrorText.of(error)
        }
    }

    private func adaylariYukle(_ rota: FieldRouteDTO) async {
        do {
            adaylar = try await APIClient.shared
                .fetchDispatchCandidates(kind: kind, routeId: rota.id).adaylar ?? []
            hata = adaylar.isEmpty ? "Bu rota için uygun araç bulunamadı." : nil
        } catch {
            hata = KBErrorText.of(error)
            adaylar = []
        }
    }

    private func ata(_ aday: DispatchCandidateDTO) async {
        guard let secili else { return }
        do {
            try await APIClient.shared.assignDispatch(
                kind: kind,
                routeId: secili.id,
                vehicleId: aday.vehicleId
            )
            adaylar = []
            toast = "\(aday.plaka ?? "Araç") rotaya atandı"
            hata = nil
            await yukle()
        } catch {
            hata = KBErrorText.of(error)
        }
    }
}

private struct FieldRouteSaveSheet: View {
    let title: String
    let noktaSayisi: Int
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: (String) -> Void
    let onCancel: () -> Void

    @State private var ad = ""

    var body: some View {
        KBFormSheet(
            title: "Yeni Rota",
            subtitle: "\(title) · \(noktaSayisi) nokta",
            submitTitle: "Rotayı Kaydet",
            canSubmit: !ad.trimmingCharacters(in: .whitespaces).isEmpty,
            isSubmitting: isSubmitting,
            errorMessage: errorMessage,
            onSubmit: { onSubmit(ad.trimmingCharacters(in: .whitespaces)) },
            onCancel: onCancel
        ) {
            KBFormTextField(title: "Rota adı", required: true, placeholder: "Merkez hattı", text: $ad)
        }
    }
}

/// Görev rotasını haritada gösteren takip ekranı.
struct GorevTakipView: View {
    let task: VehicleTaskDTO
    @State private var toast: String?
    @State private var hata: String?

    var body: some View {
        ZStack(alignment: .top) {
            KarsMapView(
                polylines: [
                    MapPolylineLayer(id: "gidis", coordinates: coordsFromPairs(task.rota?.gidis)),
                    MapPolylineLayer(id: "servis", coordinates: coordsFromPairs(task.rota?.servis)),
                ]
            )
            if let hata {
                ErrorBanner(message: hata).padding(12)
            }
        }
        .overlay(alignment: .bottom) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(task.gorevNo ?? "Görev")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(KBTheme.navy)
                    if let mesafe = KBFormat.sayi(task.rota?.mesafeKm, birim: "km") {
                        Text(mesafe)
                            .font(.caption)
                            .foregroundStyle(KBTheme.muted)
                    }
                }
                Spacer(minLength: 8)
                Button("Yeniden Analiz") {
                    Task { await yenidenAnaliz() }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .frame(minHeight: 32)
                .background(KBTheme.action)
                .clipShape(Capsule())
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(KBTheme.card)
            .safeAreaPadding(.bottom)
        }
        .kbNavigationChrome(title: task.gorevNo ?? "Takip")
        .kbToast($toast)
    }

    private func yenidenAnaliz() async {
        do {
            try await APIClient.shared.reanalyzeTask(id: task.id)
            toast = "Rota analizi yenilendi"
            hata = nil
        } catch {
            hata = KBErrorText.of(error)
        }
    }
}
