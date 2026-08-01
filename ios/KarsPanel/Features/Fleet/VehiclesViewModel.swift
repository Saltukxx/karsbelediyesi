import Foundation

@MainActor
final class VehiclesViewModel: ObservableObject {
    @Published var rows: [VehicleListItemDTO] = []
    @Published var searchText = ""
    @Published var envanterFiltre: VehicleInventoryStatus?
    @Published private(set) var total = 0
    @Published private(set) var isLoading = false
    @Published private(set) var isLoadingMore = false
    @Published var errorMessage: String?

    private let api: APIClient
    private var page = PageRequest()
    private var hasMore = false
    private var aramaGorevi: Task<Void, Never>?

    init(api: APIClient = .shared) {
        self.api = api
    }

    var ozet: [KBStat] {
        [
            KBStat(label: "Kayıt", value: "\(total)"),
            KBStat(
                label: "Görevde",
                value: "\(rows.filter { $0.operasyonDurumu == "GOREVDE" }.count)",
                tone: .info
            ),
            KBStat(
                label: "Arızalı / bakımda",
                value: "\(rows.filter { $0.operasyonDurumu == "ARIZALI" || $0.operasyonDurumu == "BAKIMDA" }.count)",
                tone: .warning
            ),
        ]
    }

    func load() async {
        page = PageRequest()
        isLoading = true
        errorMessage = nil
        do {
            let response = try await api.fetchVehiclePage(
                page: page,
                arama: searchText.isEmpty ? nil : searchText,
                envanterDurumu: envanterFiltre?.rawValue
            )
            rows = response.items
            total = response.total
            hasMore = response.hasMore
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    /// Arama her tuş vuruşunda istek atmasın diye kısa bir gecikmeyle çalışır.
    func searchChanged() {
        aramaGorevi?.cancel()
        aramaGorevi = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            await load()
        }
    }

    func loadMoreIfNeeded(current row: VehicleListItemDTO) async {
        guard hasMore, !isLoadingMore, rows.last?.id == row.id else { return }
        isLoadingMore = true
        do {
            let next = page.next
            let response = try await api.fetchVehiclePage(
                page: next,
                arama: searchText.isEmpty ? nil : searchText,
                envanterDurumu: envanterFiltre?.rawValue
            )
            page = next
            rows.append(contentsOf: response.items)
            hasMore = response.hasMore
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoadingMore = false
    }
}

@MainActor
final class VehicleDetailViewModel: ObservableObject {
    @Published private(set) var card: VehicleCardDTO?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient
    let vehicleId: String

    init(vehicleId: String, api: APIClient = .shared) {
        self.vehicleId = vehicleId
        self.api = api
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            card = try await api.fetchVehicleCard(id: vehicleId)
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }
}
