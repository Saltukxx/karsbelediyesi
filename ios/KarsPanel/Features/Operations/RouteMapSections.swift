import SwiftUI

/// Kış / çöp / temizlik rota formlarının ortak çizim bölümü.
struct RouteDrawSection: View {
    @Binding var noktalar: [KBCoordinate]
    @Binding var basemap: KBMapBasemap
    @Binding var seciliNokta: Int?
    var hata: String?

    var body: some View {
        Group {
            KBMapView(
                basemap: basemap,
                draft: $noktalar,
                seciliNoktaIndex: $seciliNokta,
                focusKey: "rota-cizim"
            )
            .frame(height: 280)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
            .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))

            KBMapBasemapPicker(basemap: $basemap)
            KBMapDrawBar(noktalar: $noktalar, seciliIndex: $seciliNokta)

            if let hata {
                Text(hata).font(.caption).foregroundStyle(KBTheme.danger)
            }
        }
    }
}

/// Rota listelerinin üstündeki genel bakış haritası.
struct RouteOverviewMap: View {
    let polylines: [KBMapPolyline]
    @Binding var basemap: KBMapBasemap
    var focusKey: String

    var body: some View {
        VStack(spacing: 10) {
            KBMapBasemapPicker(basemap: $basemap)
            KBMapView(
                polylines: polylines,
                basemap: basemap,
                showsUserLocation: false,
                focusKey: focusKey
            )
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
        }
    }
}

/// Rota satırındaki ortak alanlar: ad, öncelik rozeti, uzunluk, aktiflik.
struct RouteSummaryRow<Route: OperationRoute>: View {
    let rota: Route
    var detay: String?

    var body: some View {
        KBListRow(
            title: rota.ad,
            subtitle: [
                KBGeo.uzunlukMetni(KBGeo.uzunlukMetre(KBGeo.coordinates(rota.koordinatlar))),
                rota.aktif ? nil : "Pasif",
            ]
            .compactMap { $0 }
            .joined(separator: " · "),
            detail: detay ?? rota.notlar,
            badge: rota.oncelikEtiketi,
            badgeTone: rota.oncelikTonu.badge
        )
    }
}
