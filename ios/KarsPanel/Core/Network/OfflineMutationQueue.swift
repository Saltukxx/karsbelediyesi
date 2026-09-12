import Foundation
import Network
import UIKit

/// Saha yazma işlemleri için hafif disk kuyruğu.
/// CRDT / offline-first değil: yalnızca başarısız mutasyonları FIFO + backoff ile yeniden dener.
/// Fotoğraflar JSON şişmesin diye yan dosyada tutulur; boyut aşımında net toast.
@MainActor
final class OfflineMutationQueue: ObservableObject {
    static let shared = OfflineMutationQueue()

    static let maxSize = 50
    /// Tek kayıt JSON üst sınırı (foto dosyaları hariç meta)
    static let maxEntryJSONBytes = 256_000
    /// Tek foto dosyası üst sınırı (JPEG yeniden kodlama sonrası)
    static let maxPhotoFileBytes = 450_000

    private static let photoPrefix = "offline-photo:"

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

    private var supportDir: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    }

    private var fileURL: URL {
        supportDir.appendingPathComponent("offline-mutations.json", isDirectory: false)
    }

    private var photosDir: URL {
        supportDir.appendingPathComponent("offline-photos", isDirectory: true)
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
        let prepared = try prepareForDisk(op)
        let entry = Entry(id: UUID(), createdAt: Date(), attempts: 0, op: prepared)
        let data = try JSONEncoder().encode(entry)
        if data.count > Self.maxEntryJSONBytes {
            cleanupPhotos(in: prepared)
            throw APIError.server(
                413,
                "Kayıt çok büyük (\(data.count / 1024) KB). Fotoğrafı azaltıp bağlantı varken tekrar deneyin."
            )
        }
        entries.append(entry)
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
                cleanupPhotos(in: entry.op)
                delayNs = 0
            } catch {
                if Self.isRetriable(error) {
                    entry.attempts += 1
                    remaining.append(entry)
                    let step = min(8.0, pow(2.0, Double(max(0, entry.attempts - 1))) * 0.5)
                    delayNs = UInt64(step * 1_000_000_000)
                } else {
                    cleanupPhotos(in: entry.op)
                }
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

    // MARK: - Photo sidecar

    private func prepareForDisk(_ op: OfflineOp) throws -> OfflineOp {
        switch op {
        case let .islerimComplaint(id, durum, cozumNotu, photos):
            let stored: [String]?
            if let photos {
                stored = try photos.map { try storePhotoDataURL($0) }
            } else {
                stored = nil
            }
            return .islerimComplaint(id: id, durum: durum, cozumNotu: cozumNotu, photos: stored)
        case let .hazardCreate(lat, lng, aciklama, tip, fotolar):
            let stored: [[String: String]]?
            if let fotolar {
                stored = try fotolar.map { row -> [String: String] in
                    var copy = row
                    if let data = row["data"] {
                        copy["data"] = try storePhotoDataURL(data)
                    }
                    return copy
                }
            } else {
                stored = nil
            }
            return .hazardCreate(lat: lat, lng: lng, aciklama: aciklama, tip: tip, fotolar: stored)
        default:
            return op
        }
    }

    private func hydrate(_ op: OfflineOp) throws -> OfflineOp {
        switch op {
        case let .islerimComplaint(id, durum, cozumNotu, photos):
            let loaded: [String]?
            if let photos {
                loaded = try photos.map { try loadPhotoDataURL($0) }
            } else {
                loaded = nil
            }
            return .islerimComplaint(id: id, durum: durum, cozumNotu: cozumNotu, photos: loaded)
        case let .hazardCreate(lat, lng, aciklama, tip, fotolar):
            let loaded: [[String: String]]?
            if let fotolar {
                loaded = try fotolar.map { row -> [String: String] in
                    var copy = row
                    if let data = row["data"] {
                        copy["data"] = try loadPhotoDataURL(data)
                    }
                    return copy
                }
            } else {
                loaded = nil
            }
            return .hazardCreate(lat: lat, lng: lng, aciklama: aciklama, tip: tip, fotolar: loaded)
        default:
            return op
        }
    }

    private func storePhotoDataURL(_ value: String) throws -> String {
        if value.hasPrefix(Self.photoPrefix) { return value }
        let raw: Data
        if value.hasPrefix("data:"), let comma = value.firstIndex(of: ",") {
            let b64 = String(value[value.index(after: comma)...])
            guard let d = Data(base64Encoded: b64) else {
                throw APIError.server(413, "Fotoğraf çözülemedi; kuyruğa alınamadı.")
            }
            raw = d
        } else if let d = Data(base64Encoded: value) {
            raw = d
        } else {
            throw APIError.server(413, "Fotoğraf formatı geçersiz.")
        }

        // KBPhotoUpload limitleriyle yeniden kodla
        guard let jpeg = KBPhotoUpload.jpegData(from: raw) ?? (UIImage(data: raw).flatMap {
            KBPhotoUpload.downscaled($0).jpegData(compressionQuality: KBPhotoUpload.quality)
        }) else {
            throw APIError.server(413, "Fotoğraf yeniden kodlanamadı.")
        }
        if jpeg.count > Self.maxPhotoFileBytes {
            // Bir kademe daha agresif kalite
            guard let image = UIImage(data: jpeg) ?? UIImage(data: raw),
                  let tighter = KBPhotoUpload.downscaled(image).jpegData(compressionQuality: 0.45),
                  tighter.count <= Self.maxPhotoFileBytes else {
                throw APIError.server(
                    413,
                    "Fotoğraf çok büyük (\(jpeg.count / 1024) KB). Daha az / küçük fotoğrafla bağlantı varken tekrar deneyin."
                )
            }
            return try writePhotoFile(tighter)
        }
        return try writePhotoFile(jpeg)
    }

    private func writePhotoFile(_ jpeg: Data) throws -> String {
        try FileManager.default.createDirectory(at: photosDir, withIntermediateDirectories: true)
        let name = UUID().uuidString + ".jpg"
        let url = photosDir.appendingPathComponent(name)
        try jpeg.write(to: url, options: .atomic)
        return Self.photoPrefix + name
    }

    private func loadPhotoDataURL(_ value: String) throws -> String {
        guard value.hasPrefix(Self.photoPrefix) else { return value }
        let name = String(value.dropFirst(Self.photoPrefix.count))
        let url = photosDir.appendingPathComponent(name)
        let data = try Data(contentsOf: url)
        return "data:image/jpeg;base64,\(data.base64EncodedString())"
    }

    private func cleanupPhotos(in op: OfflineOp) {
        let refs: [String]
        switch op {
        case let .islerimComplaint(_, _, _, photos):
            refs = photos ?? []
        case let .hazardCreate(_, _, _, _, fotolar):
            refs = (fotolar ?? []).compactMap { $0["data"] }
        default:
            refs = []
        }
        for ref in refs where ref.hasPrefix(Self.photoPrefix) {
            let name = String(ref.dropFirst(Self.photoPrefix.count))
            try? FileManager.default.removeItem(at: photosDir.appendingPathComponent(name))
        }
    }

    private func execute(_ op: OfflineOp) async throws {
        let live = try hydrate(op)
        switch live {
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
            // Disk yazılamazsa bellek kuyruğu yine çalışır
        }
    }
}
