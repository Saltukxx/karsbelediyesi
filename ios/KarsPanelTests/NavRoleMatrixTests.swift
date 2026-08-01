import XCTest
@testable import KarsPanel

/// Rol matrisinin kendi içinde tutarlılığı. Web `NAV_ITEMS` / `authz.ts` ile
/// birebir karşılaştırma Faz 7'de eklenir; buradaki testler o karşılaştırmanın
/// dayanacağı değişmezleri korur.
final class NavRoleMatrixTests: XCTestCase {
    func testHerRolunEnAzBirEkraniVar() {
        for role in UserRole.allCases {
            XCTAssertFalse(
                NavItemCatalog.items(for: role).isEmpty,
                "\(role) için hiç menü öğesi yok"
            )
        }
    }

    func testLandingHedefiRolunErisebildigiEkranlardan() {
        for role in UserRole.allCases {
            let landing = NavItemCatalog.landingDestination(for: role)
            let allowed = NavItemCatalog.items(for: role).map(\.destination)
            XCTAssertTrue(
                allowed.contains(landing),
                "\(role) landing hedefi \(landing) erişilebilir listede değil"
            )
        }
    }

    func testFavorilerRolunErisebildigiEkranlarinAltKumesi() {
        for role in UserRole.allCases {
            let allowed = Set(NavItemCatalog.items(for: role).map(\.destination))
            for favorite in NavItemCatalog.favorites(for: role) {
                XCTAssertTrue(
                    allowed.contains(favorite),
                    "\(role) favorisi \(favorite) erişilebilir listede değil"
                )
            }
        }
    }

    func testTelefonSekmeleriTumEkranlariKapsarVeCakismaz() {
        for role in UserRole.allCases {
            let (primary, more) = NavItemCatalog.phoneTabs(for: role)
            let all = Set(NavItemCatalog.items(for: role).map(\.destination))

            XCTAssertLessThanOrEqual(primary.count, 4, "\(role) için 4'ten fazla ana sekme")
            XCTAssertTrue(
                Set(primary).isDisjoint(with: Set(more)),
                "\(role) sekmeleri hem ana hem Daha Fazla listesinde"
            )
            XCTAssertEqual(
                Set(primary).union(more),
                all,
                "\(role) için bazı ekranlar hiçbir sekmeden erişilemiyor"
            )
        }
    }

    func testSahaRolleriYonetimEkranlariniGormez() {
        for role in [UserRole.DRIVER, .FIELD_WORKER] {
            let destinations = Set(NavItemCatalog.items(for: role).map(\.destination))
            XCTAssertFalse(destinations.contains(.tanimlar))
            XCTAssertFalse(destinations.contains(.araclar))
            XCTAssertFalse(destinations.contains(.raporlar))
        }
    }

    func testCagriMerkeziFiloVeUretimEkranlariniGormez() {
        let destinations = Set(NavItemCatalog.items(for: .CALL_CENTER).map(\.destination))
        for gizli in [NavDestination.araclar, .bakim, .yakit, .beton, .bitum, .personel] {
            XCTAssertFalse(
                destinations.contains(gizli),
                "CALL_CENTER \(gizli) ekranını görmemeli"
            )
        }
    }

    func testAdminTumEkranlariGorur() {
        XCTAssertEqual(
            Set(NavItemCatalog.items(for: .ADMIN).map(\.destination)),
            Set(NavDestination.allCases)
        )
    }

    func testWebYollariTekilVeEgikCizgiyleBaslar() {
        var seen = Set<String>()
        for destination in NavDestination.allCases {
            let path = destination.webPath
            XCTAssertTrue(path.hasPrefix("/"), "\(destination) yolu / ile başlamıyor: \(path)")
            XCTAssertTrue(seen.insert(path).inserted, "\(path) yolu birden fazla hedefte")
        }
    }

    func testGruplamaTumOgeleriKorur() {
        for role in UserRole.allCases {
            let grouped = NavItemCatalog.groupedItems(for: role)
                .flatMap(\.items)
                .map(\.destination)
            XCTAssertEqual(
                Set(grouped),
                Set(NavItemCatalog.items(for: role).map(\.destination)),
                "\(role) gruplamada öğe kayboldu"
            )
            XCTAssertFalse(
                grouped.contains(where: { d in grouped.filter { $0 == d }.count > 1 }),
                "\(role) gruplamada yinelenen öğe var"
            )
        }
    }
}
