import Foundation

enum UserRole: String, Codable, CaseIterable {
    case ADMIN
    case CALL_CENTER
    case DEPARTMENT_MANAGER
    case FIELD_WORKER
    case DRIVER
    case APPROVER

    var label: String {
        switch self {
        case .ADMIN: return "Sistem Yöneticisi"
        case .CALL_CENTER: return "Çağrı Merkezi"
        case .DEPARTMENT_MANAGER: return "Müdürlük Yöneticisi"
        case .FIELD_WORKER: return "Saha Personeli"
        case .DRIVER: return "Şoför / Operatör"
        case .APPROVER: return "Onaylayan"
        }
    }
}
