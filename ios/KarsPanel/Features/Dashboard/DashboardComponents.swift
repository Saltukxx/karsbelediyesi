import SwiftUI

struct DashboardSectionTitle: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(KBTheme.navy)
            if let subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            }
            Spacer(minLength: 0)
        }
    }
}

struct DashboardSearchField: View {
    @State private var showSearch = false

    var body: some View {
        Button {
            showSearch = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(KBTheme.muted)
                Text("Şikayet no, plaka, personel veya görev ara...")
                    .font(.subheadline)
                    .foregroundStyle(KBTheme.muted)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(KBTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
            .overlay(
                RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                    .stroke(KBTheme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Arama")
        .sheet(isPresented: $showSearch) {
            NavigationStack { SearchPaletteView() }
        }
    }
}

struct DashboardWarningBanner: View {
    let count: Int
    let kirilim: DashboardMuayeneKirilimDTO?

    var body: some View {
        let detail: String = {
            if let k = kirilim {
                return "Muayene \(k.muayene) · Sigorta \(k.sigorta) · Bakım \(k.bakim)."
            }
            return "Detaylar araç envanterinde."
        }()
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(KBTheme.warning)
            Text("\(count) aracın muayene, sigorta veya bakım süresi 90 gün içinde doluyor ya da geçmiş. \(detail)")
                .font(.caption)
                .foregroundStyle(KBTheme.navy)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(KBTheme.warning.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                .stroke(KBTheme.warning.opacity(0.35), lineWidth: 1)
        )
    }
}

struct DashboardRangeBar: View {
    @ObservedObject var viewModel: DashboardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Dashboard")
                .font(.title2.weight(.bold))
                .foregroundStyle(KBTheme.navy)
            Text("Tüm müdürlükler · \(viewModel.rangeCaption)")
                .font(.caption)
                .foregroundStyle(KBTheme.muted)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach([DashboardRangePreset.d7, .d30, .d90], id: \.self) { item in
                        Button {
                            Task { await viewModel.applyPreset(item) }
                        } label: {
                            Text(item.label)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .foregroundStyle(viewModel.preset == item ? .white : KBTheme.navy)
                                .background(viewModel.preset == item ? KBTheme.action : KBTheme.card)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule().stroke(KBTheme.border, lineWidth: viewModel.preset == item ? 0 : 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            HStack(spacing: 8) {
                DatePicker("Başlangıç", selection: $viewModel.customStart, displayedComponents: .date)
                    .labelsHidden()
                    .environment(\.locale, Locale(identifier: "tr_TR"))
                DatePicker("Bitiş", selection: $viewModel.customEnd, displayedComponents: .date)
                    .labelsHidden()
                    .environment(\.locale, Locale(identifier: "tr_TR"))
                Button("Uygula") {
                    Task { await viewModel.applyPreset(.custom) }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(KBTheme.action)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}

struct DashboardKpiCard: View {
    let label: String
    let delta: DashboardDeltaDTO
    var format: KpiFormat = .count
    var lowerIsBetter = false
    var hint: String? = nil
    var destination: NavDestination? = nil

    enum KpiFormat {
        case count, days, money
    }

    var body: some View {
        Group {
            if let destination {
                NavigationLink {
                    DestinationView(destination: destination)
                } label: {
                    card
                }
                .buttonStyle(.plain)
            } else {
                card
            }
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(KBTheme.muted)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            Text(formattedValue)
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundStyle(KBTheme.navy)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(comparisonText)
                .font(.caption2)
                .foregroundStyle(comparisonColor)
            if let hint {
                Text(hint)
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .topLeading)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                .stroke(KBTheme.border, lineWidth: 1)
        )
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(KBTheme.navy)
                .frame(width: 3)
                .padding(.vertical, 12)
        }
    }

    private var formattedValue: String {
        switch format {
        case .count:
            return delta.current.trGrouped()
        case .days:
            return "\(delta.current.trGrouped()) gün"
        case .money:
            return "\(delta.current.trGrouped()) ₺"
        }
    }

    private var comparisonText: String {
        if delta.previous == 0 && delta.current == 0 {
            return "Önceki dönemde kayıt yok"
        }
        if delta.previous == 0 {
            return "Önceki dönemde kayıt yok"
        }
        if let pct = delta.changePct {
            let sign = pct > 0 ? "+" : ""
            return "Önceki dönem \(delta.previous.trGrouped()) (\(sign)\(pct.trGrouped())%)"
        }
        return "Önceki dönem \(delta.previous.trGrouped())"
    }

    private var comparisonColor: Color {
        guard let pct = delta.changePct, pct != 0 else { return KBTheme.muted }
        let improved = lowerIsBetter ? pct < 0 : pct > 0
        return improved ? KBTheme.success : KBTheme.danger
    }
}

struct DashboardActionCard: View {
    let title: String
    let count: Int
    let hint: String
    let icon: String
    var tone: Color = KBTheme.navy
    let destination: NavDestination

    var body: some View {
        NavigationLink {
            DestinationView(destination: destination)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: icon)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(tone)
                        .frame(width: 28, height: 28)
                        .background(tone.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KBTheme.muted)
                }
                Text("\(count)")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(KBTheme.navy)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Text(hint)
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
            .background(KBTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusMd))
            .overlay(
                RoundedRectangle(cornerRadius: KBTheme.radiusMd)
                    .stroke(KBTheme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct DashboardAnlikTile: View {
    let title: String
    let value: Int
    var tone: Color = KBTheme.navy
    var hint: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(value)")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(tone)
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(KBTheme.navy)
            if let hint {
                Text(hint)
                    .font(.caption2)
                    .foregroundStyle(KBTheme.muted)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 72, alignment: .topLeading)
        .background(KBTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
        .overlay(
            RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                .stroke(KBTheme.border, lineWidth: 1)
        )
    }
}

private extension Double {
    func trGrouped() -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = abs(self) < 10 && self.truncatingRemainder(dividingBy: 1) != 0 ? 1 : 0
        return formatter.string(from: NSNumber(value: self)) ?? "\(Int(self))"
    }
}
