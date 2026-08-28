import XCTest
@testable import KarsPanel

final class NavItemTests: XCTestCase {
    func testCallCenterLandsOnComplaints() {
        XCTAssertEqual(NavItemCatalog.landingDestination(for: .CALL_CENTER), .sikayetler)
    }

    func testFieldWorkerLandsOnIslerim() {
        XCTAssertEqual(NavItemCatalog.landingDestination(for: .FIELD_WORKER), .islerim)
        XCTAssertEqual(NavItemCatalog.landingDestination(for: .DRIVER), .islerim)
        XCTAssertFalse(NavItemCatalog.phoneTabs(for: .FIELD_WORKER).primary.contains(.dashboard))
    }

    func testAdminPhoneTabsMatchFigma() {
        XCTAssertEqual(
            NavItemCatalog.phoneTabs(for: .ADMIN).primary,
            [.dashboard, .sikayetler, .gorevler, .araclar]
        )
        XCTAssertEqual(NavDestination.dashboard.shortLabel, "Dashboard")
        XCTAssertEqual(NavDestination.araclar.shortLabel, "Araçlar")
    }

    func testCallCenterSeesComplaintsNotVehicles() {
        let dest = Set(NavItemCatalog.items(for: .CALL_CENTER).map(\.destination))
        XCTAssertTrue(dest.contains(.sikayetler))
        XCTAssertFalse(dest.contains(.araclar))
    }

    func testAdminSeesAllCoreModules() {
        let dest = Set(NavItemCatalog.items(for: .ADMIN).map(\.destination))
        XCTAssertTrue(dest.contains(.komuta))
        XCTAssertTrue(dest.contains(.harita))
        XCTAssertTrue(dest.contains(.parsel))
        XCTAssertTrue(dest.contains(.islerim))
        XCTAssertTrue(dest.contains(.denetim))
    }

    func testReleaseAPIURL() {
        XCTAssertEqual(AppConfig.productionURL.absoluteString, "https://karsbelediyesi.gbsoftt.com")
    }

    func testComplaintDTODecoding() throws {
        let json = """
        {"id":"c1","sikayetNo":"2026-0001","arayanKisi":"Ali","durum":"ACIK","oncelik":"NORMAL"}
        """.data(using: .utf8)!
        let dto = try JSONDecoder().decode(ComplaintDTO.self, from: json)
        XCTAssertEqual(dto.id, "c1")
        XCTAssertEqual(dto.durum, .ACIK)
    }
}
