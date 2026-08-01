import Foundation

/// Sabit seçenek kümesi olan enum'ların ortak arayüzü. `KBEnumField` bu
/// protokole bağlanır; tanım SwiftUI'dan bağımsız tutulur ki modelleri
/// UI olmadan da test edebilelim.
protocol KBSelectableOption: CaseIterable, Hashable, Identifiable, RawRepresentable
where RawValue == String, AllCases: RandomAccessCollection {
    var displayName: String { get }
}

extension KBSelectableOption {
    var id: String { rawValue }
}
