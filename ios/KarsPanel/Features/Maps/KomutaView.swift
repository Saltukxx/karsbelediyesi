import MapKit
import SwiftUI

/// Komuta merkezi: canlı araç konumları, açık şikayet pinleri ve alttan açılan operasyon paneli.
struct KomutaView: View {
    @State private var payload: KomutaDTO?
    @State private var hata: String?
    // Liste kapalı başlar: açıkken panel haritanın üçte ikisini kaplıyor.
    @State private var panelAcik = false
    @State private var yukleniyor = false

    private var araclar: [KomutaVehicleDTO] { payload?.araclar ?? [] }
    private var sikayetler: [MapPinDTO] { payload?.sikayetPinleri ?? [] }

    var body: some View {
        VStack(spacing: 0) {
            KBMapHeader(title: "Komuta", subtitle: "Canlı saha durumu ve akıllı görevlendirme")

            // Harita temsilcisi yığında esnek alanı tümüyle yuttuğu için panel yan yana
            // değil üstüne bindirilir; böylece kendi boyunda kalır.
            ZStack(alignment: .top) {
                KarsMapView(pins: pins)
                if let hata {
                    ErrorBanner(message: hata)
                        .padding(12)
                }
            }
            .overlay(alignment: .bottom) {
                yanPanel.safeAreaPadding(.bottom)
            }
        }
        // Yalnızca ilk yüklemede: 30 saniyelik yoklama haritayı örtmemeli.
        .overlay {
            if yukleniyor && payload == nil { LoadingOverlay() }
        }
        .kbNavigationChrome(title: "Komuta")
        .task { await yukle() }
        .kbPoll(every: 30) { await yukle() }
    }

    private var yanPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) { panelAcik.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Text("Operasyon özeti")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(KBTheme.navy)
                    Spacer()
                    Image(systemName: panelAcik ? "chevron.down" : "chevron.up")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(KBTheme.muted)
                }
                .frame(minHeight: 32)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            KBStatGrid(columns: 3) {
                KBStatCard(
                    value: "\(araclar.count)",
                    label: "Takipte araç",
                    icon: "car.fill",
                    tone: KBTheme.info
                )
                KBStatCard(
                    value: "\(konumlu.count)",
                    label: "Canlı konum",
                    icon: "location.fill",
                    tone: konumlu.isEmpty ? KBTheme.muted : KBTheme.success
                )
                KBStatCard(
                    value: "\(acikSikayet)",
                    label: "Açık şikayet",
                    icon: "exclamationmark.bubble.fill",
                    tone: acikSikayet > 0 ? KBTheme.warning : KBTheme.success
                )
            }

            if panelAcik {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        if !konumlu.isEmpty {
                            KBSectionHeader(title: "Araçlar", trailing: "\(konumlu.count) canlı")
                            ForEach(konumlu) { arac in
                                KBRecordCard(
                                    title: arac.plaka ?? arac.id,
                                    badges: [KBBadge(text: "Canlı", tone: .success)],
                                    subtitle: arac.tip,
                                    meta: KBFormat.isoTarihSaat(arac.konumZamani)
                                        .map { [KBMetaChip(icon: "clock", text: $0)] } ?? [],
                                    accent: KBTheme.success
                                )
                            }
                        }
                        if !sikayetler.isEmpty {
                            KBSectionHeader(title: "Şikayet pinleri", trailing: "\(sikayetler.count) kayıt")
                            ForEach(sikayetler) { pin in
                                KBRecordCard(
                                    title: pin.sikayetNo ?? pin.id,
                                    badges: [durumRozeti(pin.durum)].compactMap { $0 },
                                    subtitle: pin.aciklama,
                                    accent: KBTheme.warning
                                )
                            }
                        }
                        if konumlu.isEmpty && sikayetler.isEmpty {
                            EmptyStateView(
                                title: "Canlı veri yok",
                                systemImage: "dot.radiowaves.left.and.right",
                                message: "Araç konumu veya konumlu şikayet geldiğinde burada listelenir."
                            )
                            .kbCard()
                        }
                    }
                    .padding(.bottom, 8)
                }
                .frame(maxHeight: 260)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .background(KBTheme.card)
        .overlay(alignment: .top) {
            Rectangle().fill(KBTheme.border).frame(height: 1)
        }
    }

    private var konumlu: [KomutaVehicleDTO] {
        araclar.filter { $0.lat != nil && $0.lng != nil }
    }

    private var acikSikayet: Int {
        sikayetler.filter { ($0.durum ?? "").uppercased() != "KAPATILDI" }.count
    }

    private func durumRozeti(_ durum: String?) -> KBBadge? {
        guard let durum, let status = ComplaintStatus(rawValue: durum.uppercased()) else { return nil }
        return KBBadge(text: status.label, tone: status.badgeTone)
    }

    private var pins: [MapPinLayer] {
        var result: [MapPinLayer] = konumlu.compactMap { arac in
            guard let lat = arac.lat, let lng = arac.lng else { return nil }
            return MapPinLayer(
                id: arac.id,
                coordinate: .init(latitude: lat, longitude: lng),
                title: arac.plaka ?? "Araç",
                subtitle: arac.tip
            )
        }
        result += sikayetler.compactMap { pin in
            guard let lat = pin.lat, let lng = pin.lng else { return nil }
            return MapPinLayer(
                id: pin.id,
                coordinate: .init(latitude: lat, longitude: lng),
                title: pin.sikayetNo ?? "Şikayet",
                subtitle: pin.durum
            )
        }
        return result
    }

    private func yukle() async {
        yukleniyor = true
        defer { yukleniyor = false }
        do {
            payload = try await APIClient.shared.fetchKomuta()
            hata = nil
        } catch is CancellationError {
            return
        } catch {
            hata = KBErrorText.of(error)
        }
    }
}
