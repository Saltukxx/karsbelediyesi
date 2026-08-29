import MapKit
import SwiftUI

struct ParselView: View {
    @State private var parsel: ParselDTO?
    @State private var hata: String?
    @State private var sorgulaniyor = false

    var body: some View {
        VStack(spacing: 0) {
            KBMapHeader(title: "Parsel Sorgu", subtitle: "Ada, parsel ve konum bilgisi sorgulama")

            // Harita temsilcisi yığında esnek alanı tümüyle yuttuğu için panel yan yana
            // değil üstüne bindirilir; böylece kendi boyunda kalır.
            ZStack(alignment: .top) {
                KarsMapView(
                    polygons: polygons,
                    onTap: { koordinat in Task { await sorgula(koordinat) } }
                )
                if let hata {
                    ErrorBanner(message: hata).padding(12)
                }
                if sorgulaniyor {
                    ProgressView("Parsel sorgulanıyor…")
                        .padding(12)
                        .background(.regularMaterial)
                        .clipShape(Capsule())
                        .padding(.top, 12)
                }
            }
            .overlay(alignment: .bottom) {
                altPanel.safeAreaPadding(.bottom)
            }
        }
        .kbNavigationChrome(title: "Parsel Sorgu")
        .task { }
    }

    @ViewBuilder
    private var altPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let parsel {
                KBRecordCard(
                    title: "Ada \(parsel.adaNo ?? "—") / Parsel \(parsel.parselNo ?? "—")",
                    badges: parsel.nitelik.map { [KBBadge(text: $0, tone: .info)] } ?? [],
                    subtitle: [parsel.ilAd, parsel.ilceAd, parsel.mahalleAd]
                        .compactMap { $0 }
                        .joined(separator: " · "),
                    meta: meta(parsel),
                    accent: KBTheme.info
                )
            } else {
                // Panel haritanın üstünde durduğu için tam boy boş durum kartı yerine
                // tek satırlık ipucu gösterilir.
                Label("Sorgulamak istediğiniz noktaya haritada dokunun.", systemImage: "hand.tap")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(KBTheme.card)
        .overlay(alignment: .top) {
            Rectangle().fill(KBTheme.border).frame(height: 1)
        }
    }

    private func meta(_ parsel: ParselDTO) -> [KBMetaChip] {
        guard let alan = KBFormat.sayi(parsel.alan, birim: "m²") else { return [] }
        return [KBMetaChip(icon: "square.dashed", text: alan)]
    }

    private var polygons: [MapPolygonLayer] {
        guard let rings = parsel?.geometri?.coordinates?.first else { return [] }
        let coords = rings.compactMap { nokta -> CLLocationCoordinate2D? in
            guard nokta.count >= 2 else { return nil }
            return CLLocationCoordinate2D(latitude: nokta[1], longitude: nokta[0])
        }
        return [MapPolygonLayer(id: "parsel", coordinates: coords)]
    }

    private func sorgula(_ koordinat: CLLocationCoordinate2D) async {
        sorgulaniyor = true
        defer { sorgulaniyor = false }
        do {
            parsel = try await APIClient.shared.fetchParsel(
                lat: koordinat.latitude,
                lng: koordinat.longitude
            )
            hata = nil
        } catch is CancellationError {
            return
        } catch {
            hata = KBErrorText.of(error)
        }
    }
}
