import MapKit
import SwiftUI
import UIKit
import CoreLocation

struct HaritaView: View {
    @State private var payload: MapPayloadDTO?
    @State private var hata: String?
    @State private var toast: String?
    @State private var katmanlar: Set<HaritaKatmani> = Set(HaritaKatmani.allCases)
    @State private var cizim: [CLLocationCoordinate2D] = []
    @State private var showKaydet = false
    @State private var showEngel = false
    @State private var engelKoordinat: CLLocationCoordinate2D?
    @State private var seciliEngel: MapHazardDTO?
    @State private var kaydediliyor = false
    @State private var yukleniyor = false
    @State private var engelModu = false

    var body: some View {
        VStack(spacing: 0) {
            KBMapHeader(title: "Yol Haritası", subtitle: "Yollar, engeller ve şikayet katmanları")

            ZStack(alignment: .top) {
                KarsMapView(
                    polylines: polylines,
                    pins: pins,
                    onTap: { koordinat in
                        if engelModu {
                            engelKoordinat = koordinat
                            showEngel = true
                            engelModu = false
                        } else {
                            cizim.append(koordinat)
                        }
                    },
                    onSelectPin: { pinId in
                        if let hazard = payload?.hazards?.first(where: { $0.id == pinId }) {
                            seciliEngel = hazard
                        }
                    }
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
        .sheet(isPresented: $showEngel) {
            HazardCreateSheet(
                koordinat: engelKoordinat,
                isSubmitting: kaydediliyor,
                errorMessage: hata,
                onSubmit: { tip, aciklama, images in
                    Task { await engelKaydet(tip: tip, aciklama: aciklama, images: images) }
                },
                onCancel: { showEngel = false; engelKoordinat = nil }
            )
        }
        .sheet(item: $seciliEngel) { hazard in
            HazardEditSheet(
                hazard: hazard,
                isSubmitting: kaydediliyor,
                errorMessage: hata,
                onSave: { tip, aciklama, durum in
                    Task { await engelGuncelle(hazard.id, tip: tip, aciklama: aciklama, durum: durum) }
                },
                onStatus: { durum in Task { await engelDurum(hazard.id, durum) } },
                onDelete: { Task { await engelSil(hazard.id) } },
                onCancel: { seciliEngel = nil }
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
                Text(engelModu
                    ? "Engel konumu için haritaya dokunun."
                    : (cizim.isEmpty
                        ? "Yeni rota için haritaya dokunun."
                        : "\(cizim.count) nokta çizildi."))
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
                Spacer(minLength: 8)
                Button(engelModu ? "İptal" : "Engel Ekle") {
                    if engelModu {
                        engelModu = false
                    } else {
                        engelModu = true
                        // GPS varsa varsayılan konum önerisi sheet açılınca kullanılır
                    }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(engelModu ? KBTheme.danger : KBTheme.warning)
                .accessibilityIdentifier("haritaEngelEkle")
                .accessibilityLabel(engelModu ? "Engel eklemeyi iptal et" : "Engel Ekle")

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

    private func engelKaydet(tip: String, aciklama: String, images: [UIImage]) async {
        guard let koordinat = engelKoordinat else {
            hata = "Engel konumu seçilmedi. Haritaya dokunun."
            return
        }
        kaydediliyor = true
        defer { kaydediliyor = false }
        do {
            let fotolar = images.isEmpty ? nil : try await KBPhotoUpload.hazardBodies(from: images)
            let r = try await OfflineMutationQueue.shared.run(
                .hazardCreate(
                    lat: koordinat.latitude,
                    lng: koordinat.longitude,
                    aciklama: aciklama,
                    tip: tip,
                    fotolar: fotolar
                )
            )
            showEngel = false
            engelKoordinat = nil
            toast = OfflineMutationQueue.toast(for: r, success: "Engel kaydedildi")
            hata = nil
            if r == .sent { await yukle() }
        } catch is CancellationError {
        } catch {
            hata = KBErrorText.of(error)
        }
    }

    private func engelGuncelle(_ id: String, tip: String, aciklama: String, durum: String?) async {
        kaydediliyor = true
        hata = nil
        defer { kaydediliyor = false }
        do {
            let r = try await OfflineMutationQueue.shared.run(
                .hazardUpdate(id: id, durum: durum, tip: tip, aciklama: aciklama)
            )
            seciliEngel = nil
            toast = OfflineMutationQueue.toast(for: r, success: "Engel güncellendi")
            if r == .sent { await yukle() }
        } catch is CancellationError {
        } catch {
            hata = KBErrorText.of(error)
        }
    }

    private func engelDurum(_ id: String, _ durum: String) async {
        kaydediliyor = true
        defer { kaydediliyor = false }
        do {
            let r = try await OfflineMutationQueue.shared.run(
                .hazardUpdate(id: id, durum: durum, tip: nil, aciklama: nil)
            )
            seciliEngel = nil
            let okMsg = durum == "GIDERILDI" ? "Engel giderildi işaretlendi" : "Engel durumu güncellendi"
            toast = OfflineMutationQueue.toast(for: r, success: okMsg)
            hata = nil
            if r == .sent { await yukle() }
        } catch {
            hata = KBErrorText.of(error)
        }
    }

    private func engelSil(_ id: String) async {
        kaydediliyor = true
        defer { kaydediliyor = false }
        do {
            try await APIClient.shared.deleteHazard(id: id)
            seciliEngel = nil
            toast = "Engel silindi"
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

private struct HazardCreateSheet: View {
    let koordinat: CLLocationCoordinate2D?
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: (String, String, [UIImage]) -> Void
    let onCancel: () -> Void

    @State private var tip = "ENGEL"
    @State private var aciklama = ""
    @State private var images: [UIImage] = []
    @State private var lokalHata: String?

    private let tipler = [
        KBPickerOption(value: "ENGEL", label: "Engel"),
        KBPickerOption(value: "CUKUR", label: "Çukur"),
        KBPickerOption(value: "DIGER", label: "Diğer"),
    ]

    var body: some View {
        KBFormSheet(
            title: "Yeni Engel",
            subtitle: koordinat.map { String(format: "%.5f, %.5f", $0.latitude, $0.longitude) } ?? "Konum yok",
            submitTitle: "Engeli Kaydet",
            canSubmit: koordinat != nil && !aciklama.trimmingCharacters(in: .whitespaces).isEmpty && !isSubmitting,
            isSubmitting: isSubmitting,
            errorMessage: lokalHata ?? errorMessage,
            onSubmit: {
                guard koordinat != nil else {
                    lokalHata = "Konum seçilmedi. Haritaya dokunarak konum belirleyin."
                    return
                }
                onSubmit(tip, aciklama.trimmingCharacters(in: .whitespacesAndNewlines), images)
            },
            onCancel: onCancel
        ) {
            if koordinat == nil {
                Text("Haritada bir noktaya dokunarak konum seçin.")
                    .font(.caption)
                    .foregroundStyle(KBTheme.danger)
            }
            KBFormPicker(title: "Tip", required: true, selection: $tip, options: tipler)
            KBFormTextField(
                title: "Açıklama",
                required: true,
                placeholder: "Örn. yol ortasında çukur",
                text: $aciklama,
                multiline: true
            )
            KBImageSourcePicker(images: $images, title: "Engel fotoğrafı")
        }
        .interactiveDismissDisabled(isSubmitting)
    }
}

private struct HazardEditSheet: View {
    let hazard: MapHazardDTO
    let isSubmitting: Bool
    let errorMessage: String?
    let onSave: (String, String, String?) -> Void
    let onStatus: (String) -> Void
    let onDelete: () -> Void
    let onCancel: () -> Void

    @State private var tip: String = "ENGEL"
    @State private var aciklama: String = ""

    private let tipler = [
        KBPickerOption(value: "ENGEL", label: "Engel"),
        KBPickerOption(value: "CUKUR", label: "Çukur"),
        KBPickerOption(value: "DIGER", label: "Diğer"),
    ]

    var body: some View {
        KBFormSheet(
            title: "Engel Düzenle",
            subtitle: hazard.durum ?? hazard.id,
            submitTitle: "Kaydet",
            canSubmit: !aciklama.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSubmitting,
            isSubmitting: isSubmitting,
            errorMessage: errorMessage,
            onSubmit: {
                onSave(tip, aciklama.trimmingCharacters(in: .whitespacesAndNewlines), nil)
            },
            onCancel: onCancel
        ) {
            KBFormPicker(title: "Tip", required: true, selection: $tip, options: tipler)
            KBFormTextField(
                title: "Açıklama",
                required: true,
                placeholder: "Engel açıklaması",
                text: $aciklama,
                multiline: true
            )
            if let photoCount = hazard.photoIds?.count, photoCount > 0 {
                Text("Fotoğraf: \(photoCount) adet")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            }
            Button {
                let yeni = hazard.durum?.uppercased() == "GIDERILDI" ? "ACIK" : "GIDERILDI"
                onStatus(yeni)
            } label: {
                Text(hazard.durum?.uppercased() == "GIDERILDI" ? "Yeniden Aç" : "Giderildi İşaretle")
                    .frame(maxWidth: .infinity, minHeight: KBTheme.touchMin)
            }
            .buttonStyle(.bordered)
            .disabled(isSubmitting)

            Button("Engeli Sil", role: .destructive, action: onDelete)
                .disabled(isSubmitting)
                .padding(.top, 4)
        }
        .onAppear {
            tip = hazard.tip ?? "ENGEL"
            aciklama = hazard.aciklama ?? ""
        }
    }
}

