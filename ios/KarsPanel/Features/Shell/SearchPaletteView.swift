import SwiftUI

/// Marka bandındaki arama düğmesinden sheet olarak açılır.
struct SearchPaletteView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var sorgu = ""
    @State private var sonuclar: [SearchResultDTO] = []
    @State private var araniyor = false
    @State private var hata: String?

    var body: some View {
        VStack(spacing: 0) {
            baslik

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    KBSearchField(text: $sorgu, placeholder: "Şikayet no, plaka, personel veya görev...")

                    if let hata {
                        ErrorBanner(message: hata)
                    }

                    if sorgu.count < 2 {
                        EmptyStateView(
                            title: "Aramaya başlayın",
                            systemImage: "magnifyingglass",
                            message: "En az 2 karakter yazdığınızda sonuçlar listelenir."
                        )
                        .kbCard()
                    } else if sonuclar.isEmpty && !araniyor {
                        EmptyStateView(
                            title: "Sonuç bulunamadı",
                            systemImage: "questionmark.circle",
                            message: "\"\(sorgu)\" için eşleşen kayıt yok."
                        )
                        .kbCard()
                    } else {
                        ForEach(sonuclar) { sonuc in
                            KBRecordCard(
                                title: sonuc.title ?? sonuc.id,
                                badges: sonuc.type.map { [KBBadge(text: $0.capitalized, tone: .info)] } ?? [],
                                subtitle: sonuc.subtitle,
                                accent: KBTheme.info
                            )
                        }
                    }
                }
                .padding(16)
            }
        }
        .kbScreenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .task(id: sorgu) { await ara() }
    }

    private var baslik: some View {
        HStack {
            Text("Arama")
                .font(.headline)
                .foregroundStyle(.white)
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(minWidth: KBTheme.touchMin, minHeight: KBTheme.touchMin)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Kapat")
        }
        .padding(.leading, 16)
        .padding(.trailing, 4)
        .padding(.vertical, 10)
        .background(KBTheme.navy)
    }

    private func ara() async {
        guard sorgu.count >= 2 else {
            sonuclar = []
            hata = nil
            return
        }
        // Her tuş vuruşunda istek atmamak için kısa bir bekleme.
        try? await Task.sleep(nanoseconds: 300_000_000)
        guard !Task.isCancelled else { return }
        araniyor = true
        defer { araniyor = false }
        do {
            sonuclar = try await APIClient.shared.search(q: sorgu).results ?? []
            hata = nil
        } catch is CancellationError {
            return
        } catch {
            hata = KBErrorText.of(error)
            sonuclar = []
        }
    }
}
