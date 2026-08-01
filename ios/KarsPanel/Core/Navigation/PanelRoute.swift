import Foundation

/// Modül ekranlarının push ettiği detay hedefleri. Tek bir tipte toplanır ki
/// `DestinationView` bir kez `navigationDestination` kaydetsin; aksi halde aynı
/// yığında `String` gibi genel tipler modüller arasında çakışır.
enum PanelRoute: Hashable {
    case vehicle(String)
    case personnel(String)
    /// Yönetici görünümü: `/sikayetler/[id]`
    case complaint(String)
    /// Saha görünümü: `/islerim/[id]` — yalnızca atanan işler
    case workItemComplaint(String)
    case checklist(String)
    case task(String)
    /// `/gorevler/[id]/takip` rota analiz raporu
    case taskTrack(String)
}
