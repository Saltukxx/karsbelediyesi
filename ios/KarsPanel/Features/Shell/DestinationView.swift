import SwiftUI

struct DestinationView: View {
    let destination: NavDestination

    var body: some View {
        switch destination {
        case .dashboard:
            DashboardView()
        case .sikayetler:
            ComplaintsListView()
        case .whatsapp:
            WhatsAppView()
        case .gorevler:
            GorevlerView()
        case .kontrol:
            KontrolView()
        case .araclar:
            AraclarView()
        case .bakim:
            BakimView()
        case .yakit:
            YakitView()
        case .akaryakit:
            AkaryakitView()
        case .malzemeDepo:
            MalzemeDepoView()
        case .beton:
            BetonView()
        case .agrega:
            AgregaView()
        case .bitum:
            BitumView()
        case .personel:
            PersonelView()
        case .gunlukCalisma:
            GunlukCalismaView()
        case .raporlar:
            RaporlarView()
        case .tanimlar:
            TanimlarView()
        }
    }
}
