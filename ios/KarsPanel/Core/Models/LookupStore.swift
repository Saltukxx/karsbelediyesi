import Foundation

/// Form açılır listeleri uygulama ömrü boyunca bir kez yüklenir; her form
/// ekranının ayrı ayrı istek atmasını engeller.
@MainActor
final class LookupStore: ObservableObject {
    static let shared = LookupStore()

    @Published private(set) var lookups: PanelLookupsDTO?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private var yuklemeGorevi: Task<Void, Never>?
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var mudurlukler: [NamedRefDTO] { lookups?.mudurlukler ?? [] }
    var mahalleler: [NamedRefDTO] { lookups?.mahalleler ?? [] }
    var sikayetTurleri: [NamedRefDTO] { lookups?.sikayetTurleri ?? [] }
    var aracTipleri: [NamedRefDTO] { lookups?.aracTipleri ?? [] }
    var araclar: [VehicleRefDTO] { lookups?.araclar ?? [] }
    var soforler: [NamedRefDTO] { lookups?.soforler ?? [] }
    var onaylayanlar: [NamedRefDTO] { lookups?.onaylayanlar ?? [] }
    var personeller: [PersonnelRefDTO] { lookups?.personeller ?? [] }
    var betonReceteleri: [ConcreteRecipeRefDTO] { lookups?.betonReceteleri ?? [] }
    var bitumDepolari: [BitumDepotRefDTO] { lookups?.bitumDepolari ?? [] }
    var betonStokKalemleri: [ConcreteStockRefDTO] { lookups?.betonStokKalemleri ?? [] }

    /// Yüklüyse tekrar istek atmaz; eşzamanlı çağrılar tek göreve bağlanır.
    func loadIfNeeded() async {
        if lookups != nil { return }
        if let yuklemeGorevi {
            await yuklemeGorevi.value
            return
        }
        let gorev = Task { await load() }
        yuklemeGorevi = gorev
        await gorev.value
        yuklemeGorevi = nil
    }

    func reload() async {
        lookups = nil
        await load()
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            lookups = try await api.fetchPanelLookups()
        } catch {
            errorMessage = APIError.describe(error)
        }
        isLoading = false
    }

    /// Oturum kapandığında önbellek temizlenir (rol bazlı kapsam değişir).
    func clear() {
        yuklemeGorevi?.cancel()
        yuklemeGorevi = nil
        lookups = nil
        errorMessage = nil
    }
}

extension APIClient {
    func fetchPanelLookups() async throws -> PanelLookupsDTO {
        try await fetch(Endpoint("/api/v1/lookups"))
    }
}
