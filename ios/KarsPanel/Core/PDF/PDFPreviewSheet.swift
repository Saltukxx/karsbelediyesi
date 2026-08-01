import PDFKit
import SwiftUI
import UIKit

/// Rapor önizlemesi + paylaşım sayfası + AirPrint. Web'in `window.print()`
/// akışının native karşılığı.
struct PDFPreviewSheet: View {
    let document: KBPDFDocument
    let fileName: String

    @Environment(\.dismiss) private var dismiss
    @State private var data: Data?
    @State private var errorMessage: String?
    @State private var paylasilanDosya: SharedFile?

    var body: some View {
        NavigationStack {
            Group {
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(16)
                        .frame(maxHeight: .infinity, alignment: .top)
                } else if let data {
                    PDFKitView(data: data)
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    ProgressView("Rapor hazırlanıyor…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .kbScreenBackground()
            .navigationTitle("Rapor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat") { dismiss() }
                }
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        yazdir()
                    } label: {
                        Label("Yazdır", systemImage: "printer")
                    }
                    .disabled(data == nil)

                    Button {
                        paylas()
                    } label: {
                        Label("Paylaş", systemImage: "square.and.arrow.up")
                    }
                    .disabled(data == nil)
                }
            }
            .task { uret() }
            .sheet(item: $paylasilanDosya) { dosya in
                ShareSheet(items: [dosya.url])
            }
        }
    }

    private func uret() {
        guard data == nil else { return }
        data = KBPDFRenderer.render(document)
    }

    private func paylas() {
        do {
            let url = try KBPDFRenderer.write(document, fileName: fileName)
            paylasilanDosya = SharedFile(url: url)
        } catch {
            errorMessage = "Rapor dosyası oluşturulamadı: \(error.localizedDescription)"
        }
    }

    private func yazdir() {
        guard let data else { return }
        let info = UIPrintInfo(dictionary: nil)
        info.jobName = document.fileTitle
        info.outputType = .general

        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printingItem = data
        controller.present(animated: true) { _, _, error in
            if let error {
                errorMessage = "Yazdırma başlatılamadı: \(error.localizedDescription)"
            }
        }
    }
}

private struct PDFKitView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.backgroundColor = .systemGroupedBackground
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {
        if view.document == nil {
            view.document = PDFDocument(data: data)
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// `URL` doğrudan `Identifiable` yapılmaz (stdlib tipine geriye dönük uyum
/// eklemek istemiyoruz); `sheet(item:)` için sarmalanır.
struct SharedFile: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
