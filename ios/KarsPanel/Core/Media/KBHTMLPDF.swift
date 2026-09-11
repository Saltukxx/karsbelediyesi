import Foundation
import UIKit
import WebKit

/// Sunucudan gelen HTML iş emri raporunu cihazda PDF'e çevirir (puppeteer yok).
enum KBHTMLPDF {
    enum PDFError: LocalizedError {
        case emptyHTML
        case renderFailed

        var errorDescription: String? {
            switch self {
            case .emptyHTML: return "Rapor içeriği boş."
            case .renderFailed: return "PDF oluşturulamadı."
            }
        }
    }

    /// HTML baytlarını `fileName` ile geçici dizine PDF yazar.
    @MainActor
    static func writePDF(html: Data, fileName: String) async throws -> URL {
        guard !html.isEmpty, let htmlString = String(data: html, encoding: .utf8), !htmlString.isEmpty else {
            throw PDFError.emptyHTML
        }

        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 794, height: 1123))
        webView.isOpaque = false
        webView.backgroundColor = .white

        try await loadHTML(webView, htmlString)
        // CSS yerleşiminin tamamlanması için kısa nefes
        try await Task.sleep(nanoseconds: 150_000_000)

        let pdfData: Data = try await withCheckedThrowingContinuation { cont in
            webView.createPDF { result in
                cont.resume(with: result)
            }
        }
        guard !pdfData.isEmpty else { throw PDFError.renderFailed }

        let safe = fileName.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
        try pdfData.write(to: url, options: .atomic)
        return url
    }

    @MainActor
    private static func loadHTML(_ webView: WKWebView, _ html: String) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            let bridge = LoadBridge(continuation: cont)
            objc_setAssociatedObject(webView, &LoadBridge.key, bridge, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
            webView.navigationDelegate = bridge
            webView.loadHTMLString(html, baseURL: nil)
        }
    }
}

private final class LoadBridge: NSObject, WKNavigationDelegate {
    static var key: UInt8 = 0
    private var continuation: CheckedContinuation<Void, Error>?

    init(continuation: CheckedContinuation<Void, Error>) {
        self.continuation = continuation
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        resume(.success(()))
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        resume(.failure(error))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        resume(.failure(error))
    }

    private func resume(_ result: Result<Void, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        continuation.resume(with: result)
    }
}
