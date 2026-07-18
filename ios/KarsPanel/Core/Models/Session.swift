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

struct SessionDTO: Codable {
    let token: String
    let user: UserDTO
}
