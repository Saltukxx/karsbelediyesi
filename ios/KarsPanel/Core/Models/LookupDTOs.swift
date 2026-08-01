import Foundation

/// `/api/v1/lookups` — form açılır listelerinin tek kaynağı.
struct PanelLookupsDTO: Decodable {
    let mahalleler: [NamedRefDTO]
    let mudurlukler: [NamedRefDTO]
    let sikayetTurleri: [NamedRefDTO]
    let aracTipleri: [NamedRefDTO]
    let araclar: [VehicleRefDTO]
    let soforler: [NamedRefDTO]
    /// Görev / şikayet kapanışında imzalayan (APPROVER + ADMIN)
    let onaylayanlar: [NamedRefDTO]
    let personeller: [PersonnelRefDTO]
    let betonReceteleri: [ConcreteRecipeRefDTO]
    let bitumDepolari: [BitumDepotRefDTO]
    let betonStokKalemleri: [ConcreteStockRefDTO]
}

struct VehicleRefDTO: Decodable, Identifiable, Hashable {
    let id: String
    let plaka: String
    let ad: String?
    let etiket: String
}

struct PersonnelRefDTO: Decodable, Identifiable, Hashable {
    let id: String
    let adSoyad: String
    let unvan: String?
    let etiket: String
}

struct ConcreteRecipeRefDTO: Decodable, Identifiable, Hashable {
    let id: String
    let sinif: String
}

struct BitumDepotRefDTO: Decodable, Identifiable, Hashable {
    let id: String
    let ad: String
    let tip: String
}

struct ConcreteStockRefDTO: Decodable, Identifiable, Hashable {
    let malzeme: String
    let birim: String
    var id: String { malzeme }
}
