import Foundation

struct UserDTO: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let phone: String
    let role: UserRole
    let departmentId: String?
}

struct LoginRequestDTO: Encodable {
    let phone: String
    let password: String
}

struct LoginResponseDTO: Decodable {
    let token: String
    let user: UserDTO
}

struct MeDTO: Decodable {
    let user: UserDTO
    let moduleHrefs: [String]?
}

struct OkDTO: Decodable {
    let ok: Bool?
}

struct SessionDTO: Codable {
    let token: String
    let user: UserDTO
}
