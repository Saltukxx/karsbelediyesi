import MapKit
import SwiftUI

struct HaritaView: View {
    @State private var payload: MapPayloadDTO?
    @State private var hata: String?
    @State private var toast: String?
    @State private var katmanlar: Set<HaritaKatmani> = Set(HaritaKatmani.allCases)
    @State private var cizim: [CLLocationCoordinate2D] = []
    @State private var showKaydet = false
    @State private var kaydediliyor = false
    @State private var yukleniyor = false

    var body: some View {
        VStack(spacing: 0) {
            KBMapHeader(title: "Yol Haritası", subtitle: "Yollar, engeller ve şikayet katmanları")

            // Harita temsilcisi yığında esnek alanı tümüyle yuttuğu için panel yan yana
            // değil üstüne bindirilir; böylece kendi boyunda kalır.
            ZStack(alignment: .top) {
                KarsMapView(
                    polylines: polylines,
                    pins: pins,
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
        // Yalnızca ilk yüklemede: veri geldikten sonraki tazelemeler haritayı
        // örtmemeli. KBScreen'in isLoading && isEmpty kuralıyla aynı.
        .overlay {
            if yukleniyor && payload == nil { LoadingOverlay() }
        }
        .kbNavigationChrome(title: "Yol Haritası")
        .kbToast($toast)
        .task { await yukle() }
        .sheet(isPresented: $showKaydet) {
            RoadSaveSheet(
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
            KBSectionHeader(title: "Katmanlar", trailing: "\(pins.count) işaret")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(HaritaKatmani.allCases) { katman in
                        KatmanCipi(
                            katman: katman,
                            secili: katmanlar.contains(katman),
                            sayi: sayi(katman)
                        ) {
                            if katmanlar.contains(katman) {
                                katmanlar.remove(katman)
                            } else {
                                katmanlar.insert(katman)
                            }
                        }
                    }
                }
                .padding(.horizontal, 1)
            }

            HStack(spacing: 10) {
                Text(cizim.isEmpty
                    ? "Yeni rota için haritaya dokunun."
                    : "\(cizim.count) nokta çizildi.")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
                Spacer(minLength: 8)
                if !cizim.isEmpty {
                    Button("Temizle") { cizim = [] }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KBTheme.danger)
                }
                Button("Rotayı Kaydet") { showKaydet = true }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(cizim.count >= 2 ? .white : KBTheme.muted)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 32)
                    .background(cizim.count >= 2 ? KBTheme.action : KBTheme.border)
                    .clipShape(Capsule())
                    .disabled(cizim.count < 2)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(KBTheme.card)
        .overlay(alignment: .top) {
            Rectangle().fill(KBTheme.border).frame(height: 1)
        }
    }

    private func sayi(_ katman: HaritaKatmani) -> Int {
        switch katman {
        case .asfalt: return payload?.roads?.count ?? 0
        case .engel: return payload?.hazards?.count ?? 0
        case .sikayet: return payload?.complaints?.count ?? 0
        case .arac: return payload?.vehicles?.count ?? 0
        }
    }

    private var polylines: [MapPolylineLayer] {
        var lines: [MapPolylineLayer] = []
        if katmanlar.contains(.asfalt) {
            lines += (payload?.roads ?? []).map {
                MapPolylineLayer(id: $0.id, coordinates: coordsFromPairs($0.koordinatlar))
            }
        }
        if cizim.count >= 2 {
            lines.append(MapPolylineLayer(id: "draft", coordinates: cizim))
        }
        return lines
    }

    private var pins: [MapPinLayer] {
        var result: [MapPinLayer] = []
        if katmanlar.contains(.engel) {
            result += (payload?.hazards ?? []).compactMap { hazard in
                guard let lat = hazard.lat, let lng = hazard.lng else { return nil }
                return MapPinLayer(
                    id: hazard.id,
                    coordinate: .init(latitude: lat, longitude: lng),
                    title: hazard.tip ?? "Engel",
                    subtitle: hazard.aciklama
                )
            }
        }
        if katmanlar.contains(.sikayet) {
            result += (payload?.complaints ?? []).compactMap { sikayet in
                guard let lat = sikayet.lat, let lng = sikayet.lng else { return nil }
                return MapPinLayer(
                    id: sikayet.id,
                    coordinate: .init(latitude: lat, longitude: lng),
                    title: sikayet.sikayetNo ?? "Şikayet",
                    subtitle: sikayet.durum
                )
            }
        }
        if katmanlar.contains(.arac) {
            result += (payload?.vehicles ?? []).compactMap { arac in
                guard let lat = arac.lat, let lng = arac.lng else { return nil }
                return MapPinLayer(
                    id: arac.id,
                    coordinate: .init(latitude: lat, longitude: lng),
                    title: arac.plaka ?? "Araç",
                    subtitle: arac.cins
                )
            }
        }
        return result
    }

    private func yukle() async {
        yukleniyor = true
        defer { yukleniyor = false }
        do {
            payload = try await APIClient.shared.fetchMap()
            hata = nil
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
            try await APIClient.shared.saveMapRoad(
                ad: ad,
                coords: cizim.map { [$0.latitude, $0.longitude] }
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
}

enum HaritaKatmani: String, CaseIterable, Identifiable {
    case asfalt, engel, sikayet, arac

    var id: String { rawValue }

    var label: String {
        switch self {
        case .asfalt: return "Asfalt"
        case .engel: return "Engel"
        case .sikayet: return "Şikayet"
        case .arac: return "Araç"
        }
    }

    var icon: String {
        switch self {
        case .asfalt: return "road.lanes"
        case .engel: return "exclamationmark.triangle.fill"
        case .sikayet: return "exclamationmark.bubble.fill"
        case .arac: return "car.fill"
        }
    }

    var renk: Color {
        switch self {
        case .asfalt: return KBTheme.navy
        case .engel: return KBTheme.danger
        case .sikayet: return KBTheme.warning
        case .arac: return KBTheme.info
        }
    }
}

private struct KatmanCipi: View {
    let katman: HaritaKatmani
    let secili: Bool
    let sayi: Int
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 5) {
                Image(systemName: katman.icon)
                    .font(.system(size: 10, weight: .bold))
                Text(katman.label)
                    .font(.caption.weight(.semibold))
                Text("\(sayi)")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(secili ? Color.white.opacity(0.22) : KBTheme.navy.opacity(0.08))
                    .clipShape(Capsule())
            }
            .foregroundStyle(secili ? .white : KBTheme.navy)
            .padding(.horizontal, 12)
            .frame(minHeight: 34)
            .background(secili ? katman.renk : KBTheme.background)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(KBTheme.border, lineWidth: secili ? 0 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(secili ? .isSelected : [])
    }
}

private struct RoadSaveSheet: View {
    let noktaSayisi: Int
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: (String) -> Void
    let onCancel: () -> Void

    @State private var ad = ""

    var body: some View {
        KBFormSheet(
            title: "Yeni Asfalt Rotası",
            subtitle: "\(noktaSayisi) nokta ile çizildi.",
            submitTitle: "Rotayı Kaydet",
            canSubmit: !ad.trimmingCharacters(in: .whitespaces).isEmpty,
            isSubmitting: isSubmitting,
            errorMessage: errorMessage,
            onSubmit: { onSubmit(ad.trimmingCharacters(in: .whitespaces)) },
            onCancel: onCancel
        ) {
            KBFormTextField(title: "Rota adı", required: true, placeholder: "Cumhuriyet Caddesi", text: $ad)
        }
    }
}
