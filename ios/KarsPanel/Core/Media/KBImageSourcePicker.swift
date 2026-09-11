import PhotosUI
import SwiftUI
import UIKit
import AVFoundation

/// Kamera | Galeri kaynağı. Simülatörde kamera yoksa yalnızca galeri sunulur.
struct KBImageSourcePicker: View {
    @Binding var images: [UIImage]
    var maxCount: Int = KBPhotoUpload.maxCount
    var title: String = "Fotoğraf ekle"

    @State private var showSourceDialog = false
    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var libraryItems: [PhotosPickerItem] = []
    @State private var hata: String?
    @State private var hazirlaniyor = false

    private var kameraVar: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }
    private var kalan: Int { max(0, maxCount - images.count) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !images.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(images.enumerated()), id: \.offset) { index, image in
                            ZStack(alignment: .topTrailing) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 72, height: 72)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                Button {
                                    images.remove(at: index)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(.white, KBTheme.danger)
                                        .font(.system(size: 18))
                                }
                                .offset(x: 4, y: -4)
                                .accessibilityLabel("Fotoğrafı kaldır")
                            }
                        }
                    }
                }
            }

            Button {
                if kalan <= 0 {
                    hata = KBPhotoError.limitAsildi.errorDescription
                    return
                }
                if kameraVar {
                    showSourceDialog = true
                } else {
                    showLibrary = true
                }
            } label: {
                Label(
                    images.isEmpty ? title : "\(images.count)/\(maxCount) fotoğraf — ekle",
                    systemImage: "camera.fill"
                )
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: KBTheme.touchMin)
                .foregroundStyle(KBTheme.accent)
                .background(KBTheme.accent.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
            }
            .buttonStyle(.plain)
            .disabled(hazirlaniyor || kalan <= 0 && images.count >= maxCount)
            .accessibilityIdentifier("fotografEkleKontrol")
            .accessibilityLabel(title)

            if !kameraVar {
                Text("Bu cihazda kamera yok; yalnızca galeri kullanılabilir.")
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }

            if hazirlaniyor {
                ProgressView("Fotoğraflar hazırlanıyor…")
                    .font(.caption)
            }

            if let hata {
                Text(hata)
                    .font(.caption)
                    .foregroundStyle(KBTheme.danger)
            }
        }
        .confirmationDialog("Fotoğraf kaynağı", isPresented: $showSourceDialog, titleVisibility: .visible) {
            Button("Kamera") { kameraAc() }
            Button("Galeri") { showLibrary = true }
            Button("Vazgeç", role: .cancel) {}
        }
        .photosPicker(
            isPresented: $showLibrary,
            selection: $libraryItems,
            maxSelectionCount: max(1, kalan),
            matching: .images
        )
        .onChange(of: libraryItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await galeridenEkle(items) }
        }
        .fullScreenCover(isPresented: $showCamera) {
            KBCameraPicker { image in
                if let image { ekle([image]) }
            }
            .ignoresSafeArea()
        }
    }

    private func kameraAc() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            showCamera = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        showCamera = true
                    } else {
                        hata = "Kamera izni verilmedi. Ayarlar’dan izin verin veya galeriden seçin."
                    }
                }
            }
        default:
            hata = "Kamera izni yok. Ayarlar’dan izin verin veya galeriden seçin."
        }
    }

    private func galeridenEkle(_ items: [PhotosPickerItem]) async {
        hazirlaniyor = true
        hata = nil
        defer {
            hazirlaniyor = false
            libraryItems = []
        }
        do {
            var yeni: [UIImage] = []
            for item in items.prefix(kalan) {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    throw KBPhotoError.okunamadi
                }
                yeni.append(image)
            }
            ekle(yeni)
        } catch is CancellationError {
        } catch {
            hata = KBErrorText.of(error)
        }
    }

    private func ekle(_ yeni: [UIImage]) {
        let birlesik = (images + yeni).prefix(maxCount)
        images = Array(birlesik)
        if images.count >= maxCount {
            hata = nil
        }
    }
}

/// UIImagePickerController sarmalayıcısı — yalnızca kamera.
private struct KBCameraPicker: UIViewControllerRepresentable {
    var onFinish: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onFinish: (UIImage?) -> Void
        init(onFinish: @escaping (UIImage?) -> Void) { self.onFinish = onFinish }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onFinish(nil)
            picker.dismiss(animated: true)
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            onFinish(info[.originalImage] as? UIImage)
            picker.dismiss(animated: true)
        }
    }
}
