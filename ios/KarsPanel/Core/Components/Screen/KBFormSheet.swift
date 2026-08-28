import SwiftUI

/// Listeye gömülü formların yerini alan standart oluşturma/düzenleme sayfası.
/// Gönderim sırasında spinner gösterir, hatayı form içinde bırakır.
struct KBFormSheet<Content: View>: View {
    let title: String
    var subtitle: String? = nil
    var submitTitle = "Kaydet"
    var canSubmit = true
    var isSubmitting = false
    var errorMessage: String? = nil
    let onSubmit: () -> Void
    let onCancel: () -> Void
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let errorMessage {
                        ErrorBanner(message: errorMessage)
                    }
                    content()
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)

            submitBar
        }
        .background(KBTheme.background)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.white)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.72))
                }
            }
            Spacer(minLength: 8)
            Button(action: onCancel) {
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
        .padding(.vertical, 12)
        .background(KBTheme.navy)
    }

    private var submitBar: some View {
        Button(action: onSubmit) {
            if isSubmitting {
                ProgressView().tint(.white)
            } else {
                Text(submitTitle)
            }
        }
        .buttonStyle(KBPrimaryButtonStyle())
        .disabled(!canSubmit || isSubmitting)
        .opacity(canSubmit && !isSubmitting ? 1 : 0.55)
        .padding(16)
        .background(KBTheme.card)
        .overlay(alignment: .top) {
            Rectangle().fill(KBTheme.border).frame(height: 1)
        }
    }
}

// MARK: - Form alanları

struct KBFormTextField: View {
    let title: String
    var required = false
    var placeholder = ""
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var multiline = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FormFieldLabel(title: title, required: required)
            if multiline {
                TextField(placeholder, text: $text, axis: .vertical)
                    .lineLimit(3...6)
                    .padding(.vertical, 10)
                    .kbFieldChrome()
            } else {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboard)
                    .kbFieldChrome()
            }
        }
    }
}

struct KBFormPicker<Value: Hashable>: View {
    let title: String
    var required = false
    var placeholder = "Seçin"
    @Binding var selection: Value
    let options: [KBPickerOption<Value>]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FormFieldLabel(title: title, required: required)
            Menu {
                ForEach(options) { option in
                    Button(option.label) { selection = option.value }
                }
            } label: {
                HStack {
                    Text(selectedLabel ?? placeholder)
                        .font(.subheadline)
                        .foregroundStyle(selectedLabel == nil ? KBTheme.muted : KBTheme.navy)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KBTheme.muted)
                }
                .kbFieldChrome()
            }
            .disabled(options.isEmpty)
        }
    }

    private var selectedLabel: String? {
        options.first { $0.value == selection }?.label
    }
}

struct KBPickerOption<Value: Hashable>: Identifiable {
    let value: Value
    let label: String

    var id: Value { value }
}

struct KBFormDateField: View {
    let title: String
    var required = false
    @Binding var date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FormFieldLabel(title: title, required: required)
            DatePicker("", selection: $date, displayedComponents: .date)
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "tr_TR"))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

extension View {
    /// Login ekranındaki alan görünümünün paylaşılan hali.
    func kbFieldChrome() -> some View {
        self
            .padding(.horizontal, 14)
            .frame(minHeight: KBTheme.touchMin)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(KBTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
            .overlay(
                RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                    .stroke(KBTheme.border, lineWidth: 1)
            )
    }
}
