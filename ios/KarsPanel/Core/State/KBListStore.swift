import Foundation

/// Panel ekranlarının ortak veri sarmalayıcısı.
///
/// Ekranlarda dağınık duran `try?` çağrılarının yerini alır: her yükleme ve mutasyon
/// buradan geçtiği için hata mutlaka `errorMessage` üzerinden yüzeye çıkar, başarı ise
/// `toastMessage` ile bildirilir.
@MainActor
final class KBListStore<Item>: ObservableObject {
    @Published private(set) var items: [Item] = []
    @Published private(set) var isLoading = false
    @Published private(set) var hasLoadedOnce = false
    @Published var errorMessage: String?
    @Published var toastMessage: String?
    @Published var isSubmitting = false
    /// Sunucudan istenen satır sayısı; sayfalı mağazalarda "daha fazla" ile büyür.
    @Published private(set) var limit: Int

    private let loader: (Int) async throws -> [Item]
    private let pageSize: Int?

    init(loader: @escaping () async throws -> [Item]) {
        self.loader = { _ in try await loader() }
        self.pageSize = nil
        self.limit = 0
    }

    /// Sunucu tarafı `?limit=` destekleyen listeler için. Uç nokta sessizce kestiği
    /// sürece kullanıcı listenin eksik olduğunu göremiyordu; burada sınır görünür
    /// hale gelip istendiğinde büyütülebiliyor.
    init(pageSize: Int, loader: @escaping (Int) async throws -> [Item]) {
        self.loader = loader
        self.pageSize = pageSize
        self.limit = pageSize
    }

    var isEmpty: Bool { items.isEmpty }

    /// Gelen satır sayısı istenen sınıra dayandıysa arkada daha fazlası var demektir.
    var canLoadMore: Bool {
        guard pageSize != nil else { return false }
        return items.count >= limit
    }

    func loadMore() async {
        guard let pageSize, canLoadMore, !isLoading else { return }
        limit += pageSize
        await load()
    }

    /// İlk açılışta yükler; ekran tekrar göründüğünde ağı boşuna meşgul etmez.
    func loadIfNeeded() async {
        guard !hasLoadedOnce else { return }
        await load()
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer {
            isLoading = false
            hasLoadedOnce = true
        }
        do {
            items = try await loader(limit)
        } catch is CancellationError {
            return
        } catch let error as URLError where error.code == .cancelled {
            return
        } catch {
            // Elde kalan kayıtlar korunur: zayıf şebekede yenilemeye çalışan
            // kullanıcının dolu listesi silinmemeli, hata bandı yeter.
            errorMessage = KBErrorText.of(error)
        }
    }

    /// Bir yazma işlemini çalıştırır, sonucu bildirir ve listeyi tazeler.
    @discardableResult
    func mutate(success: String? = nil, _ operation: @escaping () async throws -> Void) async -> Bool {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await operation()
        } catch is CancellationError {
            return false
        } catch let error as URLError where error.code == .cancelled {
            return false
        } catch {
            errorMessage = KBErrorText.of(error)
            return false
        }
        if let success { toastMessage = success }
        await load()
        return true
    }

    /// Listeyi yeniden yüklemeden yerel olarak değiştirmek gerektiğinde.
    func replace(_ newItems: [Item]) {
        items = newItems
        hasLoadedOnce = true
    }
}

enum KBErrorText {
    static func of(_ error: Error) -> String {
        if let apiError = error as? APIError {
            return apiError.errorDescription ?? "Beklenmeyen bir hata oluştu"
        }
        return error.localizedDescription
    }
}
