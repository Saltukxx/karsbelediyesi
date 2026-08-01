import Foundation

// MARK: - Malzeme / depo

struct MaterialDTO: Codable, Identifiable, Hashable {
    let id: String
    let kod: String
    let ad: String
    let kategori: String
    let birim: String
    let depoLokasyon: String?
    let stokMiktari: Double
    let toplamGiris: Double
    let toplamCikis: Double
    let kritikStok: Double
    let kritikMi: Bool
    let birimFiyat: Double?
    let stokDegeri: Double
    let aciklama: String?
}

struct MaterialListDTO: Decodable {
    let items: [MaterialDTO]
    let total: Int
    let page: Int
    let pageSize: Int
    let kategoriler: [String]
}

struct MaterialRequestDTO: Encodable {
    var kod: String
    var ad: String
    var kategori: String
    var birim: String
    var depoLokasyon: String?
    var kritikStok: Double?
    var birimFiyat: Double?
    var aciklama: String?
}

struct MaterialMovementDTO: Codable, Identifiable, Hashable {
    let id: String
    let materialId: String
    let malzemeKodu: String
    let malzemeAdi: String
    let birim: String
    let tarih: Date?
    let tip: String
    let miktar: Double?
    let departmentId: String?
    let mudurluk: String?
    let belgeNo: String?
    let aciklama: String?
    let vehicleTaskId: String?
    let gorevNo: String?
    let otomatikMi: Bool
}

struct MaterialMovementRequestDTO: Encodable {
    var materialId: String
    var tarih: String?
    var tip: String
    var miktar: Double
    var departmentId: String?
    var belgeNo: String?
    var aciklama: String?
    var vehicleTaskId: String?
}

// MARK: - Beton

struct ConcreteResponseDTO: Decodable {
    let receteler: [ConcreteRecipeFullDTO]
    let uretimler: [ConcreteProductionDTO]
    let stoklar: [ConcreteStockDTO]
    let ozet: ConcreteTotalsDTO
}

struct ConcreteRecipeFullDTO: Codable, Identifiable, Hashable {
    let id: String
    let sinif: String
    let cimentoKg: Double
    let kumKg: Double
    let micir05Kg: Double
    let micir512Kg: Double
    let micir1219Kg: Double
    let suLt: Double
    let katkiKg: Double
    let aciklama: String?
    let aktif: Bool
    let suCimentoOrani: Double
    let toplamAgregaKg: Double
    let toplamKarisimKg: Double
    let yogunlukDurumu: String
}

struct ConcreteProductionDTO: Codable, Identifiable, Hashable {
    let id: String
    let tarih: Date?
    let recipeId: String
    let sinif: String
    let hedefM3: Double
    let cimentoKg: Double
    let kumKg: Double
    let micir05Kg: Double
    let micir512Kg: Double
    let micir1219Kg: Double
    let suLt: Double
    let katkiKg: Double
    let notlar: String?
}

struct ConcreteStockDTO: Codable, Identifiable, Hashable {
    let id: String
    let malzeme: String
    let birim: String
    let baslangicStok: Double
    let toplamGiris: Double
    let toplamCikis: Double
    let kalanStok: Double
    let kritikSeviye: Double
    let durum: String
}

struct ConcreteTotalsDTO: Decodable {
    let toplamUretimM3: Double
    let uretimSayisi: Int
}

struct ConcreteProductionRequestDTO: Encodable {
    var recipeId: String
    var tarih: String
    var hedefM3: Double
    var notlar: String?
}

struct ConcreteStockRequestDTO: Encodable {
    var malzeme: String
    var miktar: Double
}

struct ConcreteRecipeRequestDTO: Encodable {
    var cimentoKg: Double
    var kumKg: Double
    var micir05Kg: Double
    var micir512Kg: Double
    var micir1219Kg: Double
    var suLt: Double
    var katkiKg: Double
    var aciklama: String?
}

// MARK: - Agrega

struct AgregaResponseDTO: Decodable {
    let parametreler: AgregaParamsDTO?
    let boyutSatis: [AgregaBoyutSatisDTO]
    let fizikselMaliyet: AgregaFizikselResultDTO?
    let projeMaliyeti: AgregaProjeResultDTO?
}

struct AgregaParamsDTO: Codable, Hashable {
    let id: String
    let mesafeKm: Double
    let motorinFiyat: Double
    let elektrikFiyat: Double
    let sokumYakitLtSaat: Double
    let sokumAmortisman: Double
    let sokumKapasiteTonSaat: Double
    let yuklemeYakitLtSaat: Double
    let yuklemeAmortisman: Double
    let yuklemeKapasiteTonSaat: Double
    let kamyonKapasiteTon: Double
    let kamyonYakitLtKm: Double
    let seferHizKmSaat: Double
    let yuklemeBosaltmaDk: Double
    let kamyonAmortisman: Double
    let kiriciKw: Double
    let yukFaktoru: Double
    let kiriciKapasiteTonSaat: Double
    let oran05: Double
    let oran512: Double
    let oran1219: Double
    let oran1932: Double
    let donemUretimTon: Double
    let gunlukHedefTon: Double
    let yillikCalismaGun: Double
    let kiriciYakitTon: Double
    let kiriciBakimTon: Double
    let yukleyiciYakitTon: Double
    let yukleyiciBakimTon: Double
    let nakliyeYakitTon: Double
    let elekElektrikTon: Double
    let elemeBakimTon: Double
    let yikamaSuTon: Double
    let genelGiderTon: Double
}

struct AgregaBoyutSatisDTO: Codable, Identifiable, Hashable {
    let boyut: String
    let oran: Double
    let satisFiyati: Double
    let stokHedefi: Double
    var id: String { boyut }
}

struct AgregaFizikselResultDTO: Decodable {
    let asama1: Double
    let asama2: Double
    let asama3: Double
    let asama4: Double
    let toplamBirim: Double
    let boyutlar: [AgregaBoyutMaliyetDTO]
}

struct AgregaBoyutMaliyetDTO: Decodable, Identifiable, Hashable {
    let boyut: String
    let oran: Double
    let tonaj: Double
    let birimMaliyet: Double
    let toplamMaliyet: Double
    var id: String { boyut }
}

struct AgregaProjeResultDTO: Decodable {
    let maden: Double
    let nakliye: Double
    let eleme: Double
    let genel: Double
    let birim: Double
    let gunluk: Double
    let agirlikliSatis: Double
    let agirlikliKar: Double
    let toplamStokHedefi: Double
    let toplamStokMaliyeti: Double
    let toplamStokDegeri: Double
    let potansiyelKar: Double
    let boyutDetay: [AgregaProjeBoyutDTO]
}

struct AgregaProjeBoyutDTO: Decodable, Identifiable, Hashable {
    let boyut: String
    let oran: Double
    let satisFiyati: Double
    let stokHedefi: Double
    let gunlukTon: Double
    let birimMaliyet: Double
    let uretimMaliyetiGun: Double
    let brutKarTon: Double
    let stokMaliyeti: Double
    let stokDegeri: Double
    let potansiyelKar: Double
    var id: String { boyut }
}

/// Tüm alanlar opsiyonel: gönderilmeyenler sunucudaki varsayılanla doldurulur.
struct AgregaParamsRequestDTO: Encodable {
    var mesafeKm: Double?
    var motorinFiyat: Double?
    var elektrikFiyat: Double?
    var sokumYakitLtSaat: Double?
    var sokumAmortisman: Double?
    var sokumKapasiteTonSaat: Double?
    var yuklemeYakitLtSaat: Double?
    var yuklemeAmortisman: Double?
    var yuklemeKapasiteTonSaat: Double?
    var kamyonKapasiteTon: Double?
    var kamyonYakitLtKm: Double?
    var seferHizKmSaat: Double?
    var yuklemeBosaltmaDk: Double?
    var kamyonAmortisman: Double?
    var kiriciKw: Double?
    var yukFaktoru: Double?
    var kiriciKapasiteTonSaat: Double?
    var oran05: Double?
    var oran512: Double?
    var oran1219: Double?
    var oran1932: Double?
    var donemUretimTon: Double?
    var gunlukHedefTon: Double?
    var yillikCalismaGun: Double?
    var kiriciYakitTon: Double?
    var kiriciBakimTon: Double?
    var yukleyiciYakitTon: Double?
    var yukleyiciBakimTon: Double?
    var nakliyeYakitTon: Double?
    var elekElektrikTon: Double?
    var elemeBakimTon: Double?
    var yikamaSuTon: Double?
    var genelGiderTon: Double?
    var satis05: Double?
    var satis512: Double?
    var satis1219: Double?
    var satis1932: Double?
    var stok05: Double?
    var stok512: Double?
    var stok1219: Double?
    var stok1932: Double?
}

// MARK: - Bitüm

struct BitumResponseDTO: Decodable {
    let ayarlar: BitumSettingsDTO?
    let depolar: [BitumDepotDTO]
    let items: [BitumMovementDTO]
    let total: Int
    let page: Int
    let pageSize: Int
}

struct BitumSettingsDTO: Codable, Hashable {
    let depoKapasitesiTon: Double
    let mesafeKm: Double
    let tirKapasiteTon: Double
    let yakitTlKm: Double
    let seferMaliyetiTl: Double
    let tonTasimaTl: Double
    let referansAlisFiyat: Double
    let kritikEsik: Double
    let dusukEsik: Double
    let updatedAt: Date?
}

struct BitumDepotDTO: Codable, Identifiable, Hashable {
    let id: String
    let ad: String
    let tip: String
    let kapasite: Double
    let stokTon: Double
    let dolulukOrani: Double
    let durum: String
}

struct BitumMovementDTO: Codable, Identifiable, Hashable {
    let id: String
    let tarih: Date?
    let tip: String
    let miktarTon: Double
    let depoId: String?
    let depoAdi: String?
    let kaynakDepoId: String?
    let kaynakDepoAdi: String?
    let hedefDepoId: String?
    let hedefDepoAdi: String?
    let kullanimDepoId: String?
    let kullanimDepoAdi: String?
    let alisFiyati: Double?
    let alisMaliyeti: Double?
    let tirSeferSayisi: Int?
    let tasimaMaliyeti: Double?
    let kaynakOrtFiyat: Double?
    let varisMaliyetiTon: Double?
    let toplamMaliyet: Double?
    let aciklama: String?
}

struct BitumSettingsRequestDTO: Encodable {
    var depoKapasitesiTon: Double?
    var mesafeKm: Double?
    var tirKapasiteTon: Double?
    var yakitTlKm: Double?
    var referansAlisFiyat: Double?
    var kritikEsik: Double?
    var dusukEsik: Double?
}

struct BitumMovementRequestDTO: Encodable {
    var tip: String
    var tarih: String
    var miktarTon: Double
    var alisFiyati: Double?
    var depoId: String?
    var kaynakDepoId: String?
    var hedefDepoId: String?
    var kullanimDepoId: String?
    var aciklama: String?
}
