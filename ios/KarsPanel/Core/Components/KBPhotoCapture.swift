import PhotosUI
import SwiftUI
import UIKit

/// Saha fotoğrafı toplama alanı: kameradan çekim + galeriden seçim.
/// Sunucu JPEG/PNG/WebP ve en fazla 8 MB kabul ettiği için görüntüler
/// yüklemeden önce yeniden boyutlandırılıp JPEG'e çevrilir.
struct KBPhotoField: View {
    let title: String
    @Binding var photos: [HazardPhotoUpload]
    var maxCount = 4

    @State private var galeriSecimi: [PhotosPickerItem] = []
    @State private var kameraAcik = false
    @State private var hata: String?

    private var kameraVarMi: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    var body: some View {
        KBFieldContainer(title: title, required: false, error: hata) {
            VStack(alignment: .leading, spacing: 10) {
                if !photos.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(photos) { photo in
                                onizleme(photo)
                            }
                        }
                    }
                }

                HStack(spacing: 8) {
                    if kameraVarMi {
                        Button("Fotoğraf Çek") { kameraAcik = true }
                            .buttonStyle(KBChipButtonStyle(tone: .info))
                            .disabled(photos.count >= maxCount)
                    }

                    PhotosPicker(
                        selection: $galeriSecimi,
                        maxSelectionCount: maxCount,
                        matching: .images
                    ) {
                        Text("Galeriden Seç")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(KBTheme.navy)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 34)
                            .background(KBTheme.navy.opacity(0.12))
                            .clipShape(Capsule())
                    }
                    .disabled(photos.count >= maxCount)
                }

                Text("En fazla \(maxCount) fotoğraf · JPEG olarak yüklenir")
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }
        }
        .sheet(isPresented: $kameraAcik) {
            KBCameraPicker { image in
                ekle(image)
            }
            .ignoresSafeArea()
        }
        .onChange(of: galeriSecimi) { _, yeni in
            guard !yeni.isEmpty else { return }
            Task { await galeridenYukle(yeni) }
        }
    }

    private func onizleme(_ photo: HazardPhotoUpload) -> some View {
        ZStack(alignment: .topTrailing) {
            if let image = UIImage(data: photo.data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 84, height: 84)
                    .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
            }
            Button {
                photos.removeAll { $0.id == photo.id }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.white, KBTheme.danger)
                    .padding(4)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Fotoğrafı kaldır")
        }
    }

    private func galeridenYukle(_ items: [PhotosPickerItem]) async {
        for item in items {
            guard photos.count < maxCount else { break }
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                ekle(image)
            }
        }
        galeriSecimi = []
    }

    private func ekle(_ image: UIImage) {
        guard photos.count < maxCount else { return }
        guard let data = KBImageCompressor.jpeg(image) else {
            hata = "Fotoğraf işlenemedi"
            return
        }
        hata = nil
        photos.append(.jpeg(data, index: photos.count))
    }
}

/// Kamera akışı; SwiftUI'da doğrudan karşılığı olmadığı için UIKit köprüsü.
struct KBCameraPicker: UIViewControllerRepresentable {
    let onCapture: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType =
            UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture, onFinish: { dismiss() })
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate,
        UINavigationControllerDelegate
    {
        private let onCapture: (UIImage) -> Void
        private let onFinish: () -> Void

        init(onCapture: @escaping (UIImage) -> Void, onFinish: @escaping () -> Void) {
            self.onCapture = onCapture
            self.onFinish = onFinish
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                onCapture(image)
            }
            onFinish()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onFinish()
        }
    }
}

enum KBImageCompressor {
    /// Sunucu sınırı 8 MB; mobil çekimler uzun kenar 1600 px'e indirilip
    /// %70 kalitede JPEG'e çevrilir (tipik olarak 1 MB altı).
    static let maxKenar: CGFloat = 1600
    static let kalite: CGFloat = 0.7

    static func jpeg(_ image: UIImage) -> Data? {
        olcekle(image).jpegData(compressionQuality: kalite)
    }

    static func olcekle(_ image: UIImage) -> UIImage {
        let enUzun = max(image.size.width, image.size.height)
        guard enUzun > maxKenar else { return image }
        let oran = maxKenar / enUzun
        let yeniBoyut = CGSize(
            width: (image.size.width * oran).rounded(),
            height: (image.size.height * oran).rounded()
        )
        let renderer = UIGraphicsImageRenderer(size: yeniBoyut)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: yeniBoyut))
        }
    }
}
