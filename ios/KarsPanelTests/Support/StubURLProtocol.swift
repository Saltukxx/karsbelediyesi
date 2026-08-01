import Foundation

/// Ağ isteklerini yakalayan test yardımcısı. `APIClient`'a bu protokolü kullanan
/// bir `URLSession` verilir; testler yanıtı sıraya koyar ve gönderilen isteği
/// doğrular.
final class StubURLProtocol: URLProtocol {
    struct Stub {
        var statusCode: Int
        var data: Data
        var headers: [String: String]

        init(statusCode: Int = 200, data: Data = Data(), headers: [String: String] = [:]) {
            self.statusCode = statusCode
            self.data = data
            self.headers = headers
        }

        static func json(_ raw: String, statusCode: Int = 200) -> Stub {
            Stub(
                statusCode: statusCode,
                data: Data(raw.utf8),
                headers: ["Content-Type": "application/json"]
            )
        }
    }

    /// Sonraki isteğin yanıtı
    nonisolated(unsafe) static var stub = Stub()
    /// Yakalanan son istek (gövdesiyle birlikte)
    nonisolated(unsafe) static var lastRequest: URLRequest?
    nonisolated(unsafe) static var lastBody: Data?
    /// Taşıma katmanı hatası (çevrimdışı senaryoları)
    nonisolated(unsafe) static var transportError: URLError?
    /// Yakalanan istek sayısı — kuyruk testleri kaç kalem gönderildiğini sayar
    nonisolated(unsafe) static var requestCount = 0

    static func reset() {
        stub = Stub()
        lastRequest = nil
        lastBody = nil
        transportError = nil
        requestCount = 0
    }

    /// Stub protokolünü kullanan izole bir session üretir.
    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: config)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lastRequest = request
        // URLProtocol httpBody'yi soyar; akıştan okunur.
        Self.lastBody = request.httpBody ?? request.httpBodyStream.flatMap(Self.readStream)
        Self.requestCount += 1

        if let transportError = Self.transportError {
            client?.urlProtocol(self, didFailWithError: transportError)
            return
        }

        let stub = Self.stub
        let response = HTTPURLResponse(
            url: request.url ?? URL(string: "https://invalid.local")!,
            statusCode: stub.statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: stub.headers
        )!

        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        if !stub.data.isEmpty {
            client?.urlProtocol(self, didLoad: stub.data)
        }
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func readStream(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        let size = 4096
        var buffer = [UInt8](repeating: 0, count: size)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: size)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}
