import SwiftUI
import UIKit

struct BrandMarkView: View {
    var light = false
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 8 : 12) {
            logoMark
            if !compact {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Kars Belediyesi")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(light ? .white : KBTheme.navy)
                    Text("Operasyon Paneli")
                        .font(.caption)
                        .foregroundStyle(light ? Color.white.opacity(0.75) : KBTheme.muted)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Kars Belediyesi Operasyon Paneli")
    }

    @ViewBuilder
    private var logoMark: some View {
        Group {
            if UIImage(named: "Logo") != nil {
                Image("Logo")
                    .resizable()
                    .scaledToFit()
            } else {
                Text("KB")
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(light ? Color.white.opacity(0.18) : KBTheme.navy)
            }
        }
        .frame(width: compact ? 32 : 40, height: compact ? 32 : 40)
        .clipShape(RoundedRectangle(cornerRadius: 9))
    }
}

struct StatusBadge: View {
    let text: String
    var tone: Tone = .neutral

    enum Tone {
        case neutral, success, warning, danger, info, accent

        var foreground: Color {
            switch self {
            case .neutral: return KBTheme.navy
            case .success: return KBTheme.success
            case .warning: return KBTheme.warning
            case .danger: return KBTheme.danger
            case .info: return KBTheme.info
            case .accent: return KBTheme.accent
            }
        }
    }

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(tone.foreground)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tone.foreground.opacity(0.12))
            .clipShape(Capsule())
            .lineLimit(1)
    }
}

struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.subheadline)
            Text(message)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .foregroundStyle(KBTheme.danger)
        .padding(14)
        .background(KBTheme.danger.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
        .accessibilityLabel("Hata: \(message)")
    }
}

struct EmptyStateView: View {
    let title: String
    let systemImage: String
    var message: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 36, weight: .medium))
                .foregroundStyle(KBTheme.navy.opacity(0.35))
                .frame(width: 72, height: 72)
                .background(KBTheme.navy.opacity(0.06))
                .clipShape(Circle())

            Text(title)
                .font(.headline)
                .foregroundStyle(KBTheme.navy)
                .multilineTextAlignment(.center)

            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(KBTheme.muted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 8)
            }

            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(KBPrimaryButtonStyle())
                    .frame(maxWidth: 220)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
        .padding(.horizontal, 20)
    }
}

struct LoadingOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.08).ignoresSafeArea()
            ProgressView("Yükleniyor…")
                .padding(22)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
        }
    }
}

struct SectionHeaderLabel: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.headline.weight(.semibold))
                .foregroundStyle(KBTheme.navy)
            if let subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 2)
    }
}

struct FormFieldLabel: View {
    let title: String
    var required = false

    var body: some View {
        HStack(spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(KBTheme.navy)
            if required {
                Text("*")
                    .foregroundStyle(KBTheme.danger)
            }
        }
    }
}

extension ComplaintStatus {
    var badgeTone: StatusBadge.Tone {
        switch self {
        case .ACIK: return .info
        case .DEVAM_EDIYOR: return .warning
        case .KAPATILDI: return .success
        case .IPTAL: return .neutral
        }
    }
}

extension ComplaintPriority {
    var badgeTone: StatusBadge.Tone {
        switch self {
        case .NORMAL: return .neutral
        case .ACIL: return .warning
        case .COK_ACIL: return .danger
        }
    }
}
