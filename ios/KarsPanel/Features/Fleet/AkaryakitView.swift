import SwiftUI

/// `/akaryakit` — tüketim analizi ve aylık rapor. Sadece okuma; hesaplar sunucuda.
struct AkaryakitAnalysisView: View {
    @StateObject private var viewModel = AkaryakitViewModel()
    @ObservedObject private var lookups = LookupStore.shared

    var body: some View {
        KBModuleScreen(
            title: NavDestination.akaryakit.label,
            icon: NavDestination.akaryakit.icon,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            isEmpty: viewModel.data == nil,
            emptyMessage: "Analiz için araç ve yakıt kaydı gerekiyor.",
            onRefresh: { await viewModel.load() }
        ) {
            if let data = viewModel.data {
                Section {
                    KBStatRow(tiles: viewModel.ozet)
                        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                        .listRowBackground(Color.clear)
                }

                Section("Filtre") {
                    KBPickerField(
                        title: "Müdürlük",
                        items: lookups.mudurlukler,
                        selection: $viewModel.mudurluk,
                        placeholder: "Tümü",
                        label: { $0.name ?? "—" }
                    )
                    Picker("Ay", selection: $viewModel.ay) {
                        ForEach(data.aylar, id: \.self) { ay in
                            Text(ay).tag(Optional(ay))
                        }
                    }
                    .pickerStyle(.menu)
                }

                Section("Tüketim analizi") {
                    ForEach(data.analiz) { row in
                        KBListRow(
                            title: row.plaka,
                            subtitle: analizAltBaslik(row),
                            detail: analizDetay(row),
                            badge: row.durum.map(tuketimEtiketi),
                            badgeTone: (row.durum.map(tuketimTonu) ?? .neutral).badge,
                            trailingValue: row.gercekTuketim.map {
                                String(format: "%.2f", $0)
                            }
                        )
                    }
                }

                Section("Aylık rapor — \(data.ay)") {
                    ForEach(data.aylik) { row in
                        KBListRow(
                            title: row.plaka,
                            subtitle: "\(row.yakit) · \(row.adet) işlem",
                            detail: row.ortBirimFiyat.map {
                                "Ort. birim fiyat: \(String(format: "%.2f", $0)) ₺"
                            },
                            trailingValue: KBNumberFormat.para(row.tutar)
                        )
                    }
                    KBDetailRow(
                        label: "TOPLAM",
                        value: "\(KBNumberFormat.miktar(data.toplam.litre, birim: "lt")) · "
                            + KBNumberFormat.para(data.toplam.tutar)
                    )
                }
            }
        }
        .onChange(of: viewModel.mudurluk) { _, _ in Task { await viewModel.load() } }
        .onChange(of: viewModel.ay) { _, _ in Task { await viewModel.load() } }
        .task {
            await lookups.loadIfNeeded()
            if viewModel.data == nil { await viewModel.load() }
        }
    }

    private func analizAltBaslik(_ row: AkaryakitAnalysisRowDTO) -> String {
        let tip = row.sayacTipi == "SAAT" ? "Saat" : "Kilometre"
        return "\(row.mudurluk ?? "—") · \(tip)"
    }

    private func analizDetay(_ row: AkaryakitAnalysisRowDTO) -> String {
        var parts = [
            KBNumberFormat.miktar(row.toplamLitre, birim: "lt"),
            KBNumberFormat.para(row.toplamTutar),
            "Sayaç farkı: \(KBNumberFormat.miktar(row.sayacFarki))",
        ]
        if row.norm > 0 { parts.append("Norm: \(KBNumberFormat.miktar(row.norm))") }
        return parts.joined(separator: " · ")
    }

    private func tuketimEtiketi(_ durum: String) -> String {
        switch durum {
        case "YUKSEK": return "Yüksek"
        case "DIKKAT": return "Dikkat"
        case "NORMAL": return "Normal"
        default: return durum
        }
    }

    private func tuketimTonu(_ durum: String) -> StatusBadgeTone {
        switch durum {
        case "YUKSEK": return .danger
        case "DIKKAT": return .warning
        case "NORMAL": return .success
        default: return .neutral
        }
    }
}

@MainActor
final class AkaryakitViewModel: ObservableObject {
    @Published private(set) var data: AkaryakitResponseDTO?
    @Published var mudurluk: String?
    @Published var ay: String?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var ozet: [KBStat] {
        guard let data else { return [] }
        let yuksek = data.analiz.filter { $0.durum == "YUKSEK" }.count
        return [
            KBStat(label: "Araç", value: "\(data.analiz.count)"),
            KBStat(
                label: "Aylık litre",
                value: KBNumberFormat.miktar(data.toplam.litre, birim: "lt")
            ),
            KBStat(label: "Aylık tutar", value: KBNumberFormat.para(data.toplam.tutar), tone: .accent),
            KBStat(
                label: "Yüksek tüketim",
                value: "\(yuksek)",
                tone: yuksek > 0 ? .danger : .success
            ),
        ]
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await api.fetchAkaryakitAnalysis(mudurluk: mudurluk, ay: ay)
            data = response
            // Sunucu geçerli ayı normalize eder; seçim ilk yüklemede eşitlenir.
            if ay == nil { ay = response.ay }
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }
}
