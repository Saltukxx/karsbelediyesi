import SwiftUI

struct ReportsView: View {
    @StateObject private var store = KBListStore { try await APIClient.shared.fetchReports() }
    @State private var disaAktarilan: String?
    @State private var paylasilacak: KBExportFile?
    @State private var disaAktarimHatasi: String?

    var body: some View {
        KBScreen(
            title: "Raporlar",
            description: "Excel dışa aktarımları ve özet raporlar.",
            isLoading: store.isLoading,
            errorMessage: store.errorMessage ?? disaAktarimHatasi,
            isEmpty: store.isEmpty,
            empty: KBEmptyConfig(
                title: "Rapor tanımı yok",
                systemImage: "doc.text.fill",
                message: "Yetkinize açık bir rapor bulunmuyor."
            ),
            refresh: { await store.load() }
        ) {
            if !store.isEmpty {
                KBStatGrid {
                    KBStatCard(
                        value: "\(store.items.count)",
                        label: "Hazır rapor",
                        icon: "doc.text.fill"
                    )
                    KBStatCard(
                        value: disaAktarilan == nil ? "—" : "1",
                        label: "Dışa aktarılıyor",
                        icon: "square.and.arrow.up.fill",
                        tone: disaAktarilan == nil ? KBTheme.muted : KBTheme.accent,
                        hint: disaAktarilan
                    )
                }
            }

            ForEach(store.items) { rapor in
                KBRecordCard(
                    title: rapor.baslik ?? rapor.id,
                    badges: [KBBadge(text: "Excel", tone: .neutral)],
                    subtitle: rapor.aciklama,
                    actions: [
                        KBRecordAction(
                            id: "\(rapor.id)-export",
                            title: disaAktarilan == rapor.id ? "Hazırlanıyor..." : "Excel'e Aktar",
                            icon: "square.and.arrow.up",
                            kind: .primary
                        ) {
                            Task { await disaAktar(rapor.id) }
                        },
                    ],
                    accent: KBTheme.accent
                )
            }
        }
        .task { await store.loadIfNeeded() }
        .kbToast($store.toastMessage)
        .sheet(item: $paylasilacak) { dosya in
            KBShareSheet(items: [dosya.url])
        }
    }

    private func disaAktar(_ id: String) async {
        guard disaAktarilan == nil else { return }
        disaAktarilan = id
        disaAktarimHatasi = nil
        defer { disaAktarilan = nil }
        do {
            let data = try await APIClient.shared.exportEntity(id)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(id).xlsx")
            try data.write(to: url)
            paylasilacak = KBExportFile(url: url)
            store.toastMessage = "Rapor hazırlandı"
        } catch {
            disaAktarimHatasi = KBErrorText.of(error)
        }
    }
}

struct KBExportFile: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

struct KBShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
