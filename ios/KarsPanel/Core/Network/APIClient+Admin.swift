import Foundation

/// Tanımlar, denetim izi ve raporlar uçları (Faz 6).
extension APIClient {
    // MARK: - Tanımlar

    func fetchTanimlar() async throws -> TanimlarDTO {
        try await fetch(Endpoint("/api/v1/definitions"))
    }

    func createMahalle(name: String) async throws -> TanimOgesiDTO {
        try await send(
            Endpoint("/api/v1/definitions/mahalleler", method: .post),
            body: AdRequestDTO(name: name)
        )
    }

    func createAracCinsi(name: String) async throws -> TanimOgesiDTO {
        try await send(
            Endpoint("/api/v1/definitions/arac-cinsleri", method: .post),
            body: AdRequestDTO(name: name)
        )
    }

    func createMudurluk(_ body: MudurlukRequestDTO) async throws -> MudurlukTanimDTO {
        try await send(Endpoint("/api/v1/definitions/mudurlukler", method: .post), body: body)
    }

    func updateMudurluk(
        id: String,
        _ body: MudurlukRequestDTO
    ) async throws -> MudurlukTanimDTO {
        try await send(
            Endpoint("/api/v1/definitions/mudurlukler/\(id)", method: .patch),
            body: body
        )
    }

    func createSikayetTuru(
        _ body: SikayetTuruRequestDTO
    ) async throws -> SikayetTuruTanimDTO {
        try await send(
            Endpoint("/api/v1/definitions/sikayet-turleri", method: .post),
            body: body
        )
    }

    func updateSikayetTuru(
        id: String,
        _ body: SikayetTuruRequestDTO
    ) async throws -> SikayetTuruTanimDTO {
        try await send(
            Endpoint("/api/v1/definitions/sikayet-turleri/\(id)", method: .patch),
            body: body
        )
    }

    func createKullanici(
        _ body: KullaniciOlusturRequestDTO
    ) async throws -> PanelKullaniciDTO {
        try await send(
            Endpoint("/api/v1/definitions/kullanicilar", method: .post),
            body: body
        )
    }

    func updateKullanici(
        id: String,
        _ body: KullaniciGuncelleRequestDTO
    ) async throws -> PanelKullaniciDTO {
        try await send(
            Endpoint("/api/v1/definitions/kullanicilar/\(id)", method: .patch),
            body: body
        )
    }

    @discardableResult
    func setOtomatikAtama(_ acik: Bool) async throws -> DispatchAyarDTO {
        try await send(
            Endpoint("/api/v1/definitions/dispatch-ayari", method: .put),
            body: DispatchAyarRequestDTO(otomatikAtama: acik)
        )
    }

    // MARK: - Denetim izi

    func fetchDenetim(
        kullanici: String? = nil,
        islem: String? = nil,
        varlik: String? = nil,
        baslangic: Date? = nil,
        bitis: Date? = nil,
        page: Int = 1,
        size: Int? = nil
    ) async throws -> DenetimListesiDTO {
        try await fetch(
            Endpoint("/api/v1/denetim").adding([
                .optional("kullanici", kullanici),
                .optional("islem", islem),
                .optional("varlik", varlik),
                .optionalDate("baslangic", baslangic),
                .optionalDate("bitis", bitis),
                .optional("page", page),
                .optional("size", size),
            ])
        )
    }

    // MARK: - Raporlar

    func fetchRaporOzeti() async throws -> RaporOzetiDTO {
        try await fetch(Endpoint("/api/v1/reports/ozet"))
    }

    func fetchMahalleAnalizi(gun: Int? = nil) async throws -> [MahalleAnaliziDTO] {
        try await fetch(
            Endpoint("/api/v1/reports/mahalle").adding([.optional("gun", gun)])
        )
    }

    func fetchIsMaliyeti(gun: Int? = nil) async throws -> IsMaliyetiDTO {
        try await fetch(
            Endpoint("/api/v1/reports/is-maliyeti").adding([.optional("gun", gun)])
        )
    }

    func fetchExportKatalogu() async throws -> [ExportKalemiDTO] {
        try await fetch(Endpoint("/api/v1/reports"))
    }
}
