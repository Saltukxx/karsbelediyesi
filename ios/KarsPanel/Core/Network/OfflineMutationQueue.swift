import Foundation
import Network

/// Saha yazma işlemleri için hafif disk kuyruğu.
/// CRDT / offline-first değil: yalnızca başarısız mutasyonları FIFO + backoff ile yeniden dener.
@MainActor
final class OfflineMutationQueue: ObservableObject {
    static let shared = OfflineMutationQueue()

    static let maxSize = 50

    enum RunResult: Equatable {
        case sent
        case queued
    }

    enum OfflineOp: Codable {
        case islerimComplaint(id: String, durum: String, cozumNotu: String?, photos: [String]?)
        case islerimAsfalt(id: String, durum: String)
        case checklistPatch(id: String, action: String, extra: [String: String])
        case hazardCreate(lat: Double, lng: Double, aciklama: String, tip: String, fotolar: [[String: String]]?)
        case hazardUpdate(id: String, durum: String?, tip: String?, aciklama: String?)
        case complaintUpdate(id: String, body: UpdateComplaintFullDTO)
        case taskKm(id: String, action: String, km: Double?)
    }

    private struct Entry: Codable, Identifiable {
        let id: UUID
        let createdAt: Date
        var attempts: Int
        let op: OfflineOp
    }

    @Published private(set) var pendingCount = 0

    private var entries: [Entry] = []
    private var flushing = false
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "tr.gov.kars.panel.offline-monitor")
    private var fileURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("offline-mutations.json", isDirectory: false)
    }

    private init() {
        load()
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            Task { @MainActor in
                await self?.flush()
            }
        }
        monitor.start(queue: monitorQueue)
    }

    /// Canlı dene; ağ hatasında kuyruğa al ve `.queued` dön (çağıran başarı gibi kapanabilir).
    @discardableResult
    func run(_ op: OfflineOp) async throws -> RunResult {
        do {
            try await execute(op)
            return .sent
        } catch {
            guard Self.isRetriable(error) else { throw error }
            try enqueue(op)
            return .queued
        }
    }

    func enqueue(_ op: OfflineOp) throws {
        if entries.count >= Self.maxSize {
            throw APIError.server(429, "Senkron kuyruğu dolu (\(Self.maxSize)). Bağlantı gelince bekleyenler bitsin.")
        }
        entries.append(Entry(id: UUID(), createdAt: Date(), attempts: 0, op: op))
        persist()
    }

    func flush() async {
        guard !flushing, !entries.isEmpty else { return }
        flushing = true
        defer { flushing = false }

        var remaining: [Entry] = []
        var delayNs: UInt64 = 0

        for var entry in entries {
            if delayNs > 0 {
                try? await Task.sleep(nanoseconds: delayNs)
            }
            do {
                try await execute(entry.op)
                delayNs = 0
            } catch {
                if Self.isRetriable(error) {
                    entry.attempts += 1
                    remaining.append(entry)
                    // 0.5s, 1s, 2s… üst 8s
                    let step = min(8.0, pow(2.0, Double(max(0, entry.attempts - 1))) * 0.5)
                    delayNs = UInt64(step * 1_000_000_000)
                }
                // Kalıcı hata (4xx vb.) → düşür, kullanıcı tekrar dener
            }
        }

        entries = remaining
        persist()
    }

    static func isRetriable(_ error: Error) -> Bool {
        if error is CancellationError { return false }
        if let api = error as? APIError {
            switch api {
            case .network: return true
            case .unauthorized, .forbidden, .loginRedirect, .invalidURL, .notFound, .endpointMissing, .decoding:
                return false
            case .server(let code, _):
                return code >= 500 || code == 408 || code == 429
            case .unknown:
                return true
            }
        }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain {
            switch ns.code {
            case NSURLErrorCancelled: return false
            case NSURLErrorNotConnectedToInternet,
                 NSURLErrorTimedOut,
                 NSURLErrorNetworkConnectionLost,
                 NSURLErrorCannotFindHost,
                 NSURLErrorCannotConnectToHost,
                 NSURLErrorDNSLookupFailed,
                 NSURLErrorInternationalRoamingOff,
                 NSURLErrorDataNotAllowed,
                 NSURLErrorSecureConnectionFailed:
                return true
            default:
                return false
            }
        }
        return false
    }

    static func toast(for result: RunResult, success: String) -> String {
        switch result {
        case .sent:
            return success
        case .queued:
            let n = OfflineMutationQueue.shared.pendingCount
            return "Senkron bekliyor (\(n))"
        }
    }

    private func execute(_ op: OfflineOp) async throws {
        switch op {
        case let .islerimComplaint(id, durum, cozumNotu, photos):
            try await APIClient.shared.updateIslerimComplaint(
                id: id, durum: durum, cozumNotu: cozumNotu, photos: photos
            )
        case let .islerimAsfalt(id, durum):
            try await APIClient.shared.updateIslerimAsfalt(id: id, durum: durum)
        case let .checklistPatch(id, action, extra):
            try await APIClient.shared.patchChecklist(id: id, action: action, extra: extra)
        case let .hazardCreate(lat, lng, aciklama, tip, fotolar):
            try await APIClient.shared.saveHazard(
                lat: lat, lng: lng, aciklama: aciklama, tip: tip, fotolar: fotolar
            )
        case let .hazardUpdate(id, durum, tip, aciklama):
            try await APIClient.shared.updateHazard(id: id, durum: durum, tip: tip, aciklama: aciklama)
        case let .complaintUpdate(id, body):
            _ = try await APIClient.shared.updateComplaintFull(id: id, body: body)
        case let .taskKm(id, action, km):
            _ = try await APIClient.shared.updateTaskKm(id: id, action: action, km: km)
        }
    }

    private func load() {
        defer { pendingCount = entries.count }
        let url = fileURL
        guard FileManager.default.fileExists(atPath: url.path) else {
            entries = []
            return
        }
        do {
            let data = try Data(contentsOf: url)
            entries = try JSONDecoder().decode([Entry].self, from: data)
        } catch {
            entries = []
        }
    }

    private func persist() {
        pendingCount = entries.count
        do {
            let dir = fileURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(entries)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            // Disk yazılamazsa bellek kuyruğu yine çalışır; sonraki flush'ta tekrar deneriz
        }
    }
}
