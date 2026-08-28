import Foundation
import PhotosUI
import SwiftUI
import UIKit

/// Seçilen fotoğrafları yüklenebilir hale getirir.
///
/// Ham veriyi doğrudan göndermek iki şeyi bozuyordu: iPhone galerisi varsayılan olarak
/// HEIC veriyor ama sunucu mime bilgisi olmayan gövdeyi `image/jpeg` sayıp `.jpg`
/// uzantısıyla yazıyor, ve tek kare base64'te birkaç megabayta çıkıp mobil hatta
/// yüklenemiyordu. Burada uzun kenar kırpılıp JPEG'e kodlanıyor, mime de data-URL ile
/// açıkça bildiriliyor.
enum KBPhotoUpload {
    static let maxEdge: CGFloat = 1600
    static let quality: CGFloat = 0.7

    /// Sunucunun beklediği `data:image/jpeg;base64,...` dizisini üretir.
    /// Okunamayan bir kare sessizce düşürülmez, hata olarak yüzeye çıkar.
    static func dataURLs(from items: [PhotosPickerItem]) async throws -> [String] {
        var sonuc: [String] = []
        for item in items {
            guard let ham = try await item.loadTransferable(type: Data.self) else {
                throw KBPhotoError.okunamadi
            }
            // Tam çözünürlüklü kare çözmek pahalı; arayüzü bloklamasın.
            guard let jpeg = await Task.detached(priority: .userInitiated, operation: {
                jpegData(from: ham)
            }).value else {
                throw KBPhotoError.cozumlenemedi
            }
            sonuc.append("data:image/jpeg;base64,\(jpeg.base64EncodedString())")
        }
        return sonuc
    }

    /// UIImage'ın açabildiği her biçimi (HEIC dahil) küçültülmüş JPEG'e çevirir.
    static func jpegData(from data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        return downscaled(image).jpegData(compressionQuality: quality)
    }

    static func downscaled(_ image: UIImage) -> UIImage {
        let uzunKenar = max(image.size.width, image.size.height)
        guard uzunKenar > maxEdge else { return image }

        let oran = maxEdge / uzunKenar
        let hedef = CGSize(width: image.size.width * oran, height: image.size.height * oran)

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true

        return UIGraphicsImageRenderer(size: hedef, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: hedef))
        }
    }
}

enum KBPhotoError: LocalizedError {
    case okunamadi
    case cozumlenemedi

    var errorDescription: String? {
        switch self {
        case .okunamadi:
            return "Seçilen fotoğraf okunamadı. Fotoğrafı tekrar seçip deneyin."
        case .cozumlenemedi:
            return "Fotoğraf biçimi desteklenmiyor."
        }
    }
}
