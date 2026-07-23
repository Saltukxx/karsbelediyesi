import Foundation

@MainActor
final class ModuleListViewModel: ObservableObject {
    @Published var title = ""
    @Published var rows: [ModuleRow] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    /// "Rota" aksiyonu seçilen görev — sheet ile harita açılır
    @Published var routeTask: VehicleTaskDTO?

    private var tasksById: [String: VehicleTaskDTO] = [:]

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    struct ModuleAction: Identifiable, Hashable {
        let id: String
        let recordId: String
        let label: String
        let kind: String
        let destructive: Bool
    }

    struct ModuleRow: Identifiable, Hashable {
        let id: String
        let primary: String
        let secondary: String?
        var actions: [ModuleAction] = []
    }

    func load(destination: NavDestination) async {
        title = destination.label
        isLoading = true
        errorMessage = nil
        rows = []
        defer { isLoading = false }

        do {
            rows = try await fetchRows(for: destination)
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func perform(action: ModuleAction, destination: NavDestination) async {
        errorMessage = nil
        if action.kind == "map" {
            routeTask = tasksById[action.recordId]
            return
        }
        do {
            switch destination {
            case .whatsapp:
                _ = try await api.updateWhatsApp(id: action.recordId, action: action.kind)
            case .gorevler:
                _ = try await api.updateTask(id: action.recordId, action: action.kind)
            default:
                return
            }
            await load(destination: destination)
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func fetchRows(for destination: NavDestination) async throws -> [ModuleRow] {
        switch destination {
        case .whatsapp:
            return try await api.fetchWhatsAppQueue().map {
                ModuleRow(
                    id: $0.id,
                    primary: $0.telefon ?? "—",
                    secondary: $0.icerik,
                    actions: [
                        ModuleAction(id: "\($0.id)-approve", recordId: $0.id, label: "Onayla", kind: "approve", destructive: false),
                        ModuleAction(id: "\($0.id)-reject", recordId: $0.id, label: "Reddet", kind: "reject", destructive: true),
                    ]
                )
            }
        case .gorevler:
            let tasks = try await api.fetchTasks()
            tasksById = Dictionary(uniqueKeysWithValues: tasks.map { ($0.id, $0) })
            return tasks.map { task in
                var actions: [ModuleAction] = []
                if task.rota != nil {
                    actions.append(ModuleAction(id: "\(task.id)-map", recordId: task.id, label: "Rota", kind: "map", destructive: false))
                }
                if task.durum == "PLANLANDI" {
                    actions.append(ModuleAction(id: "\(task.id)-start", recordId: task.id, label: "Başlat", kind: "start", destructive: false))
                }
                if task.durum == "DEVAM_EDIYOR" || task.durum == "PLANLANDI" {
                    actions.append(ModuleAction(id: "\(task.id)-close", recordId: task.id, label: "Kapat", kind: "close", destructive: true))
                }
                return ModuleRow(
                    id: task.id,
                    primary: task.gorevNo ?? task.id,
                    secondary: [task.durum, task.vehicle?.plaka].compactMap { $0 }.joined(separator: " · "),
                    actions: actions
                )
            }
        case .kontrol:
            return try await api.fetchChecklists().map {
                ModuleRow(id: $0.id, primary: $0.sablonAdi ?? $0.id, secondary: $0.durum)
            }
        case .araclar:
            return try await api.fetchVehicles().map {
                ModuleRow(id: $0.id, primary: $0.plaka ?? $0.id, secondary: $0.cins)
            }
        case .bakim:
            return try await api.fetchMaintenance().map {
                ModuleRow(id: $0.id, primary: $0.plaka ?? $0.id, secondary: $0.bakimTipi)
            }
        case .yakit:
            return try await api.fetchFuelRecords().map {
                ModuleRow(id: $0.id, primary: $0.plaka ?? $0.id, secondary: String(format: "%.1f L", $0.litre ?? 0))
            }
        case .akaryakit:
            return try await api.fetchFuelAnalysis().map {
                ModuleRow(
                    id: $0.id,
                    primary: $0.plaka ?? $0.id,
                    secondary: String(format: "%@ · %.1f", $0.donem ?? "—", $0.ortalamaTuketim ?? 0)
                )
            }
        case .malzemeDepo:
            return try await api.fetchMaterials().map {
                ModuleRow(
                    id: $0.id,
                    primary: $0.malzemeAdi ?? $0.id,
                    secondary: String(format: "%.1f %@", $0.stokMiktari ?? 0, $0.birim ?? "")
                )
            }
        case .beton:
            return try await api.fetchConcrete().map {
                ModuleRow(id: $0.id, primary: $0.receteAdi ?? $0.id, secondary: $0.sinif)
            }
        case .agrega:
            return try await api.fetchAgrega().map {
                ModuleRow(id: $0.id, primary: $0.malzeme ?? $0.id, secondary: String(format: "₺%.2f", $0.toplam ?? 0))
            }
        case .bitum:
            return try await api.fetchBitum().map {
                ModuleRow(id: $0.id, primary: $0.proje ?? $0.id, secondary: $0.aciklama)
            }
        case .personel:
            return try await api.fetchPersonnel().map {
                ModuleRow(id: $0.id, primary: $0.adSoyad ?? $0.id, secondary: $0.unvan)
            }
        case .gunlukCalisma:
            return try await api.fetchWorkLogs().map {
                ModuleRow(id: $0.id, primary: $0.personelAdi ?? $0.id, secondary: $0.plaka)
            }
        case .raporlar:
            return try await api.fetchReports().map {
                ModuleRow(id: $0.id, primary: $0.baslik ?? $0.id, secondary: $0.tip)
            }
        case .tanimlar:
            let defs = try await api.fetchDefinitions()
            var result: [ModuleRow] = []
            defs.departments?.forEach { result.append(ModuleRow(id: "dep-\($0.id)", primary: $0.name ?? $0.id, secondary: "Müdürlük")) }
            defs.neighborhoods?.forEach { result.append(ModuleRow(id: "mah-\($0.id)", primary: $0.name ?? $0.id, secondary: "Mahalle")) }
            defs.complaintTypes?.forEach { result.append(ModuleRow(id: "tur-\($0.id)", primary: $0.name ?? $0.id, secondary: "Şikayet Türü")) }
            return result
        case .dashboard, .sikayetler:
            return []
        }
    }
}
