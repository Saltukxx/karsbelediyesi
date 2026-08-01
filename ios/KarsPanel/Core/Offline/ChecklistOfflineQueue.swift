import Foundation

/// Bağlantı yokken kaydedilen kontrol kalemleri diske yazılır ve bağlantı
/// geldiğinde sırayla gönderilir. Kalem kaydı idempotent (`upsert`) olduğu için
/// aynı kalem birden fazla kez gönderilse de sonuç değişmez.
@MainActor
final class ChecklistOfflineQueue: ObservableObject {
    static let shared = ChecklistOfflineQueue()

    struct PendingItem: Codable, Identifiable, Hashable {
        let id: UUID
        let submissionId: String
        let request: ChecklistItemRequestDTO
        let queuedAt: Date

        init(submissionId: String, request: ChecklistItemRequestDTO) {
            id = UUID()
            self.submissionId = submissionId
            self.request = request
            queuedAt = Date()
        }
    }

    @Published private(set) var pending: [PendingItem] = []
    @Published private(set) var isFlushing = false
    @Published private(set) var lastError: String?

    private let api: APIClient
    private let storeURL: URL

    init(api: APIClient = .shared, storeURL: URL? = nil) {
        self.api = api
        self.storeURL = storeURL
            ?? FileManager.default
                .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("checklist-offline-queue.json")
        pending = yukle()
    }

    func pendingCount(submissionId: String) -> Int {
        pending.filter { $0.submissionId == submissionId }.count
    }

    /// Aynı kalem × periyot için bekleyen kayıt varsa üzerine yazılır; kullanıcı
    /// çevrimdışıyken sonucu değiştirebilir.
    func enqueue(submissionId: String, request: ChecklistItemRequestDTO) {
        pending.removeAll {
            $0.submissionId == submissionId
                && $0.request.templateItemId == request.templateItemId
                && $0.request.periyot == request.periyot
        }
        pending.append(PendingItem(submissionId: submissionId, request: request))
        kaydet()
    }

    /// Bekleyen kalemleri sırayla gönderir. Bağlantı yine yoksa kuyruk korunur.
    /// - Returns: sunucuya iletilen kalem sayısı.
    @discardableResult
    func flush() async -> Int {
        guard !pending.isEmpty, !isFlushing else { return 0 }
        isFlushing = true
        lastError = nil
        var gonderilen = 0

        for item in pending {
            do {
                _ = try await api.saveChecklistItem(
                    submissionId: item.submissionId,
                    item.request
                )
                pending.removeAll { $0.id == item.id }
                gonderilen += 1
            } catch {
                if APIError.isOffline(error) {
                    // Bağlantı hâlâ yok: kalan kalemler kuyrukta bekler
                    break
                }
                // Kalıcı hata (silinmiş form, karara bağlanmış form): kuyruktan
                // düşürülür, aksi halde kuyruk asla boşalmaz.
                pending.removeAll { $0.id == item.id }
                lastError = APIError.describe(error)
            }
        }

        kaydet()
        isFlushing = false
        return gonderilen
    }

    func clear(submissionId: String) {
        pending.removeAll { $0.submissionId == submissionId }
        kaydet()
    }

    // MARK: - Kalıcılık

    private func yukle() -> [PendingItem] {
        guard let data = try? Data(contentsOf: storeURL) else { return [] }
        return (try? JSONDecoder().decode([PendingItem].self, from: data)) ?? []
    }

    private func kaydet() {
        do {
            try FileManager.default.createDirectory(
                at: storeURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try JSONEncoder().encode(pending).write(to: storeURL, options: .atomic)
        } catch {
            lastError = "Çevrimdışı kuyruk diske yazılamadı: \(error.localizedDescription)"
        }
    }
}
