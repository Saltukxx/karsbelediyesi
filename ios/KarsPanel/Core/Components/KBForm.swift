import SwiftUI

/// Modül formlarının ortak alan bileşenleri. Web panelindeki form davranışını
/// karşılar: zorunlu alan işareti, alan bazlı hata, Türkçe ondalık ayırıcı,
/// boş bırakılan opsiyonel alanların gönderilmemesi.
enum KBForm {}

// MARK: - Metin

struct KBTextField: View {
    let title: String
    @Binding var text: String
    var required = false
    var placeholder: String = ""
    var keyboard: UIKeyboardType = .default
    var capitalization: TextInputAutocapitalization = .sentences
    var error: String?
    var multiline = false

    var body: some View {
        KBFieldContainer(title: title, required: required, error: error) {
            if multiline {
                TextEditor(text: $text)
                    .frame(minHeight: 88)
                    .textInputAutocapitalization(capitalization)
            } else {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(capitalization)
                    .autocorrectionDisabled(keyboard != .default)
            }
        }
    }
}

// MARK: - Sayı

/// Sayısal alanlar metin olarak tutulur; hem virgül hem nokta kabul edilir ve
/// boş bırakıldığında sunucuya `nil` gider.
struct KBNumberField: View {
    let title: String
    @Binding var text: String
    var required = false
    var suffix: String?
    var decimals = true
    var error: String?

    var body: some View {
        KBFieldContainer(title: title, required: required, error: error) {
            HStack(spacing: 6) {
                TextField(decimals ? "0,00" : "0", text: $text)
                    .keyboardType(decimals ? .decimalPad : .numberPad)
                if let suffix {
                    Text(suffix)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                }
            }
        }
    }
}

// MARK: - Tarih

struct KBDateField: View {
    let title: String
    @Binding var date: Date?
    var required = false
    var components: DatePickerComponents = [.date]
    var error: String?

    var body: some View {
        KBFieldContainer(title: title, required: required, error: error) {
            HStack {
                if let bound = Binding($date) {
                    DatePicker("", selection: bound, displayedComponents: components)
                        .labelsHidden()
                    if !required {
                        Button("Temizle") { date = nil }
                            .font(.caption)
                            .buttonStyle(.plain)
                            .foregroundStyle(KBTheme.accent)
                    }
                } else {
                    Button("Tarih seç") { date = Date() }
                        .font(.subheadline)
                        .buttonStyle(.plain)
                        .foregroundStyle(KBTheme.navy)
                    Spacer()
                }
            }
        }
    }
}

// MARK: - Saat (HH:mm)

/// Sunucu mesai saatlerini `HH:mm` metni olarak bekler (Excel formülleriyle
/// birebir hesaplanabilmesi için).
struct KBTimeField: View {
    let title: String
    @Binding var value: String
    var required = true
    var error: String?

    var body: some View {
        KBFieldContainer(title: title, required: required, error: error) {
            DatePicker(
                "",
                selection: Binding(
                    get: { KBTimeFormat.parse(value) ?? KBTimeFormat.defaultTime },
                    set: { value = KBTimeFormat.format($0) }
                ),
                displayedComponents: [.hourAndMinute]
            )
            .labelsHidden()
        }
    }
}

enum KBTimeFormat {
    static let defaultTime: Date = parse("08:00") ?? Date()

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f
    }()

    static func parse(_ text: String) -> Date? {
        formatter.date(from: text)
    }

    static func format(_ date: Date) -> String {
        formatter.string(from: date)
    }

    static func isValid(_ text: String) -> Bool {
        parse(text) != nil
    }
}

// MARK: - Seçim

/// Opsiyonel referans seçimi (müdürlük, araç, personel…). `nil` = seçilmedi.
struct KBPickerField<Item: Identifiable & Hashable>: View {
    let title: String
    let items: [Item]
    @Binding var selection: Item.ID?
    var required = false
    var placeholder = "Seçilmedi"
    var error: String?
    let label: (Item) -> String

    var body: some View {
        KBFieldContainer(title: title, required: required, error: error) {
            Picker(title, selection: $selection) {
                Text(placeholder).tag(Item.ID?.none)
                ForEach(items) { item in
                    Text(label(item)).tag(Optional(item.id))
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// Çoklu seçim (şikayete personel atama gibi). Web'deki `<select multiple>`
/// karşılığı; seçilenler satırın altında rozet olarak listelenir.
struct KBMultiSelectField<Item: Identifiable & Hashable>: View where Item.ID == String {
    let title: String
    let items: [Item]
    @Binding var selection: Set<String>
    var required = false
    var emptyText = "Seçilmedi"
    var error: String?
    let label: (Item) -> String

    var body: some View {
        KBFieldContainer(title: title, required: required, error: error) {
            VStack(alignment: .leading, spacing: 8) {
                if items.isEmpty {
                    Text("Atanabilir kayıt yok")
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                } else {
                    ForEach(items) { item in
                        Button {
                            if selection.contains(item.id) {
                                selection.remove(item.id)
                            } else {
                                selection.insert(item.id)
                            }
                        } label: {
                            HStack(spacing: 10) {
                                Image(
                                    systemName: selection.contains(item.id)
                                        ? "checkmark.square.fill"
                                        : "square"
                                )
                                .foregroundStyle(
                                    selection.contains(item.id) ? KBTheme.navy : KBTheme.muted
                                )
                                Text(label(item))
                                    .font(.subheadline)
                                    .foregroundStyle(KBTheme.navy)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                            }
                            .frame(minHeight: KBTheme.touchMin)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(
                            selection.contains(item.id) ? [.isSelected] : []
                        )
                    }
                }

                if selection.isEmpty {
                    Text(emptyText)
                        .font(.caption)
                        .foregroundStyle(KBTheme.muted)
                } else {
                    Text("\(selection.count) kayıt seçildi")
                        .font(.caption)
                        .foregroundStyle(KBTheme.accent)
                }
            }
        }
    }
}

/// Sabit seçenek kümesi (enum'lar). Her zaman bir değer seçilidir.
struct KBEnumField<Option: KBSelectableOption>: View {
    let title: String
    @Binding var selection: Option
    var error: String?

    var body: some View {
        KBFieldContainer(title: title, required: true, error: error) {
            Picker(title, selection: $selection) {
                ForEach(Option.allCases) { option in
                    Text(option.displayName).tag(option)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Alan kabı

struct KBFieldContainer<Content: View>: View {
    let title: String
    var required: Bool
    var error: String?
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            FormFieldLabel(title: title, required: required)
            content()
            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(KBTheme.danger)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(required ? "\(title), zorunlu" : title)
    }
}

// MARK: - Kaydetme çubuğu

/// Form alt aksiyonu: kaydetme sırasında kilitlenir, hata mesajını gösterir.
struct KBFormActions: View {
    let saveTitle: String
    var isSaving: Bool
    var isEnabled: Bool = true
    var errorMessage: String?
    let onSave: () -> Void
    var onCancel: (() -> Void)?

    var body: some View {
        VStack(spacing: 10) {
            if let errorMessage {
                ErrorBanner(message: errorMessage)
            }
            Button {
                onSave()
            } label: {
                if isSaving {
                    ProgressView()
                } else {
                    Text(saveTitle)
                }
            }
            .buttonStyle(KBPrimaryButtonStyle())
            .disabled(isSaving || !isEnabled)

            if let onCancel {
                Button("İptal", action: onCancel)
                    .buttonStyle(KBPrimaryButtonStyle(filled: false))
                    .disabled(isSaving)
            }
        }
    }
}
