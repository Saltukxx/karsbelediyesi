import SwiftUI

/// Bir rota için skorlanmış araç adayları. Web'deki `SmartAssignPanel`in
/// karşılığı: kış / çöp / temizlik rota satırından açılır.
struct SmartAssignView: View {
    let tip: DispatchTip
    let routeId: String
    let routeAd: String
    /// Atama sonrası çağıran ekranın listeyi tazelemesi için
    var onAssigned: () -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = SmartAssignViewModel()

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Section { ErrorBanner(message: errorMessage) }
            }

            Section {
                KBDetailRow(label: "Rota", value: routeAd)
                KBDetailRow(label: "Tür", value: tip.displayName)
                Text(
                    """
                    Adaylar süre, araç tipi uygunluğu, konum tazeliği, iş yükü \
                    ve yakıt durumuna göre 100 üzerinden puanlanır.
                    """
                )
                .font(.caption2)
                .foregroundStyle(KBTheme.muted)
            }

            if viewModel.adaylar.isEmpty, !viewModel.isLoading {
                Section {
                    EmptyStateView(
                        title: "Uygun araç bulunamadı",
                        systemImage: "truck.box",
                        message: """
                        Müsait ve konumu bilinen araç yok. Şoförlerin konum \
                        paylaşımını açık tuttuğundan emin olun.
                        """
                    )
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            }

            ForEach(Array(viewModel.adaylar.enumerated()), id: \.element.id) { index, aday in
                Section {
                    AdayKarti(
                        aday: aday,
                        enUygun: index == 0,
                        atanabilir: !viewModel.islemYapiliyor
                    ) {
                        Task {
                            if await viewModel.ata(tip: tip, routeId: routeId, aday: aday) {
                                onAssigned()
                            }
                        }
                    }
                }
            }

            if let bilgi = viewModel.bilgiMesaji {
                Section {
                    Text(bilgi)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KBTheme.success)
                }
            }

            Section {
                Button("Otomatik öner (onaya düşer)") {
                    Task { await viewModel.oner(tip: tip, routeId: routeId) }
                }
                .buttonStyle(KBPrimaryButtonStyle(filled: false))
                .disabled(viewModel.islemYapiliyor)
                Text(
                    """
                    Öneri, komuta ekranındaki "bekleyen atamalar" listesine \
                    düşer; oradan onaylanınca görev açılır.
                    """
                )
                .font(.caption2)
                .foregroundStyle(KBTheme.muted)
            }
        }
        .listStyle(.insetGrouped)
        .hideScrollBackgroundIfAvailable()
        .kbScreenBackground()
        .navigationTitle("Akıllı Atama")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await viewModel.load(tip: tip, routeId: routeId) }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } }
        }
        .overlay {
            if viewModel.isLoading, viewModel.adaylar.isEmpty { LoadingOverlay() }
        }
        .task { await viewModel.load(tip: tip, routeId: routeId) }
    }
}

/// Kış / çöp / temizlik ekranlarının akıllı atama sayfasını açmak için taşıdığı
/// hedef. Aynı rota kimliği farklı türlerde tekrar edebilir.
struct SmartAssignTarget: Identifiable, Hashable {
    let tip: DispatchTip
    let routeId: String
    let routeAd: String

    var id: String { "\(tip.rawValue):\(routeId)" }
}

extension View {
    /// Üç operasyon ekranının ortak akıllı atama sayfası.
    func smartAssignSheet(
        _ target: Binding<SmartAssignTarget?>,
        onAssigned: @escaping () -> Void
    ) -> some View {
        sheet(item: target) { hedef in
            NavigationStack {
                SmartAssignView(
                    tip: hedef.tip,
                    routeId: hedef.routeId,
                    routeAd: hedef.routeAd,
                    onAssigned: onAssigned
                )
            }
        }
    }
}

private struct AdayKarti: View {
    let aday: DispatchAdayDTO
    let enUygun: Bool
    let atanabilir: Bool
    let onAta: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(aday.plaka)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
                if let tip = aday.tip {
                    Text(tip)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
                Spacer(minLength: 8)
                StatusBadge(text: "\(aday.skor) puan", tone: enUygun ? .success : .neutral)
            }

            if enUygun {
                Text("En uygun aday")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KBTheme.success)
            }

            Text(aday.mesafeMetni)
                .font(.caption)
                .foregroundStyle(KBTheme.muted)

            Text(aday.kirilim.ozet)
                .font(.caption2)
                .foregroundStyle(KBTheme.muted)

            if !aday.etiketler.isEmpty {
                // Etiketler ("uygun tip", "yakıt düşük") satıra sığmazsa alt
                // satıra akar; sabit sütun sayısı dar ekranda kesiyordu.
                FlowingTags(etiketler: aday.etiketler)
            }

            if aday.bayat {
                Text("Konumu bayat — otomatik önerilmez, elle atanabilir.")
                    .font(.caption2)
                    .foregroundStyle(KBTheme.warning)
            }

            Button("Bu Aracı Ata", action: onAta)
                .buttonStyle(KBPrimaryButtonStyle(filled: enUygun))
                .disabled(!atanabilir)
        }
    }
}

/// Etiketleri kullanılabilir genişliğe göre sarmalayan basit yerleşim.
private struct FlowingTags: View {
    let etiketler: [String]

    var body: some View {
        LazyVGrid(
            columns: [.init(.adaptive(minimum: 92), spacing: 6, alignment: .leading)],
            alignment: .leading,
            spacing: 6
        ) {
            ForEach(etiketler, id: \.self) { etiket in
                Text(etiket)
                    .font(.caption2)
                    .foregroundStyle(KBTheme.navy)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(KBTheme.background)
                    .clipShape(Capsule())
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
final class SmartAssignViewModel: ObservableObject {
    @Published private(set) var adaylar: [DispatchAdayDTO] = []
    @Published private(set) var isLoading = false
    @Published private(set) var islemYapiliyor = false
    @Published var errorMessage: String?
    @Published var bilgiMesaji: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func load(tip: DispatchTip, routeId: String) async {
        isLoading = true
        errorMessage = nil
        do {
            adaylar = try await api.fetchDispatchCandidates(tip: tip, routeId: routeId).adaylar
        } catch {
            adaylar = []
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    /// Atama başarılıysa true; çağıran ekran listesini tazeler.
    func ata(tip: DispatchTip, routeId: String, aday: DispatchAdayDTO) async -> Bool {
        islemYapiliyor = true
        errorMessage = nil
        bilgiMesaji = nil
        var basarili = false
        do {
            let sonuc = try await api.assignVehicleToRoute(
                tip: tip,
                routeId: routeId,
                vehicleId: aday.vehicleId
            )
            bilgiMesaji = "\(aday.plaka) atandı · görev \(sonuc.gorevNo)"
            basarili = true
        } catch {
            errorMessage = APIError.describe(error)
        }
        islemYapiliyor = false
        // Atanan araç artık müsait değil; skorlar yeniden hesaplanır.
        await load(tip: tip, routeId: routeId)
        return basarili
    }

    func oner(tip: DispatchTip, routeId: String) async {
        islemYapiliyor = true
        errorMessage = nil
        bilgiMesaji = nil
        do {
            if let oneri = try await api.suggestDispatch(tip: tip, routeId: routeId) {
                bilgiMesaji = "\(oneri.plaka) önerildi — komuta ekranından onaylayın"
            } else {
                errorMessage = "Öneri üretilemedi: uygun araç bulunamadı"
            }
        } catch {
            errorMessage = APIError.describe(error)
        }
        islemYapiliyor = false
    }
}
