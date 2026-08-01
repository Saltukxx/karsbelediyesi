import Foundation

/// `/raporlar` — SLA, müdürlük KPI'ı, mahalle analizi, iş maliyeti ve Excel
/// dışa aktarma. Web sayfası gibi pencereler sabittir (24s / 3g / 30g / 90g).
@MainActor
final class RaporlarViewModel: ObservableObject {
    @Published private(set) var ozet: RaporOzetiDTO?
    @Published private(set) var mahalleler: [MahalleAnaliziDTO] = []
    @Published private(set) var maliyet: IsMaliyetiDTO?
    @Published private(set) var exportlar: [ExportKalemiDTO] = []
    @Published private(set) var isLoading = false
    @Published private(set) var indirilenEntity: String?
    @Published var errorMessage: String?
    @Published var paylasilanDosya: SharedFile?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var sla: SlaOzetiDTO? { ozet?.sla }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            // Dört uç birbirinden bağımsız; paralel çekilir
            async let ozetIstek = api.fetchRaporOzeti()
            async let mahalleIstek = api.fetchMahalleAnalizi()
            async let maliyetIstek = api.fetchIsMaliyeti()
            async let exportIstek = api.fetchExportKatalogu()

            ozet = try await ozetIstek
            mahalleler = try await mahalleIstek
            maliyet = try await maliyetIstek
            exportlar = try await exportIstek
        } catch {
            errorMessage = APIError.describe(error)
        }
    }

    /// Excel dosyasını indirip geçici dizine yazar ve paylaşım sayfasını açar.
    func excelIndir(_ kalem: ExportKalemiDTO) async {
        indirilenEntity = kalem.entity
        errorMessage = nil
        defer { indirilenEntity = nil }
        do {
            let dosya = try await api.exportEntity(kalem.entity)
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent(dosya.filename)
            try dosya.data.write(to: url, options: .atomic)
            paylasilanDosya = SharedFile(url: url)
        } catch {
            errorMessage = APIError.describe(error)
        }
    }
}
