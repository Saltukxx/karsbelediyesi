import SwiftUI

/// `/raporlar` — Raporlar & Dışa Aktarma. Web sayfasındaki beş bölümün karşılığı.
struct RaporlarView: View {
    @StateObject private var viewModel = RaporlarViewModel()

    var body: some View {
        List {
            if let error = viewModel.errorMessage {
                Section { ErrorBanner(message: error) }
            }

            slaBolumu
            gecikenAcilBolumu
            mudurlukKpiBolumu
            mahalleBolumu
            isMaliyetiBolumu
            genelToplamBolumu
            exportBolumu
        }
        .listStyle(.insetGrouped)
        .navigationTitle(NavDestination.raporlar.label)
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if viewModel.isLoading, viewModel.ozet == nil { LoadingOverlay() }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .sheet(item: $viewModel.paylasilanDosya) { dosya in
            ShareSheet(items: [dosya.url])
        }
    }

    // MARK: - Şikayet SLA

    private var slaBolumu: some View {
        Section {
            if let sla = viewModel.sla {
                KBStatRow(
                    tiles: [
                        KBStat(label: "24 saatten az", value: "\(sla.bucketLt24h)"),
                        KBStat(label: "1–3 gün", value: "\(sla.bucket1to3d)"),
                        KBStat(
                            label: "3 günden fazla",
                            value: "\(sla.bucketGt3d)",
                            tone: sla.bucketGt3d > 0 ? .danger : .neutral
                        ),
                    ]
                )
            } else if !viewModel.isLoading {
                Text("Veri yok").font(.caption).foregroundStyle(KBTheme.muted)
            }
        } header: {
            Text("Şikayet SLA")
        }
    }

    @ViewBuilder
    private var gecikenAcilBolumu: some View {
        if let geciken = viewModel.sla?.overdueUrgent, !geciken.isEmpty {
            Section {
                ForEach(geciken) { s in
                    NavigationLink(value: PanelRoute.complaint(s.id)) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(s.sikayetNo)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(KBTheme.navy)
                                StatusBadge(
                                    text: s.oncelikEtiketi,
                                    tone: s.oncelikTonu.badge
                                )
                                Spacer(minLength: 0)
                            }
                            Text(s.arayanKisi).font(.subheadline)
                            Text(
                                "\(s.departmentName ?? "—") · "
                                    + s.kayitTarihi.formatted(
                                        date: .abbreviated,
                                        time: .shortened
                                    )
                            )
                            .font(.caption2)
                            .foregroundStyle(KBTheme.muted)
                        }
                    }
                }
            } header: {
                Text("Geciken acil / çok acil (24 saatten fazla)")
            }
        }
    }

    private var mudurlukKpiBolumu: some View {
        Section {
            let satirlar = viewModel.sla?.byDepartment ?? []
            if satirlar.isEmpty {
                Text("Veri yok").font(.caption).foregroundStyle(KBTheme.muted)
            } else {
                ForEach(satirlar) { row in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.departmentName)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(KBTheme.navy)
                        HStack(spacing: 12) {
                            DegerEtiketi(baslik: "Açık", deger: "\(row.acik)")
                            DegerEtiketi(
                                baslik: "Kapatılan (30g)",
                                deger: "\(row.kapatilan30g)"
                            )
                            DegerEtiketi(
                                baslik: "Ort. kapanış",
                                deger: row.ortKapanisGun.map { "\(gunMetni($0)) gün" } ?? "—"
                            )
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        } header: {
            Text("Müdürlük KPI (son 30 gün kapanış)")
        }
    }

    // MARK: - Mahalle analizi

    private var mahalleBolumu: some View {
        Section {
            if viewModel.mahalleler.isEmpty {
                Text("Son 90 günde konumlu şikayet yok")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            } else {
                ForEach(viewModel.mahalleler) { m in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(m.ad)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(KBTheme.navy)
                            Spacer(minLength: 0)
                            if m.acik > 0 {
                                StatusBadge(text: "\(m.acik) açık", tone: .warning)
                            }
                        }
                        HStack(spacing: 12) {
                            DegerEtiketi(baslik: "Toplam", deger: "\(m.toplam)")
                            DegerEtiketi(baslik: "Kapanan", deger: "\(m.kapanan)")
                            DegerEtiketi(
                                baslik: "Ort. çözüm",
                                deger: m.ortCozumGun.map { "\(gunMetni($0)) gün" } ?? "—"
                            )
                        }
                        Text("En sık tip: \(m.enSikTip)")
                            .font(.caption2)
                            .foregroundStyle(KBTheme.muted)
                    }
                    .padding(.vertical, 2)
                }
            }
        } header: {
            Text("Mahalle Analizi (son 90 gün)")
        }
    }

    // MARK: - İş maliyeti

    private var isMaliyetiBolumu: some View {
        Section {
            let satirlar = viewModel.maliyet?.satirlar ?? []
            if satirlar.isEmpty {
                Text("Son 30 günde kapanan görev yok")
                    .font(.caption)
                    .foregroundStyle(KBTheme.muted)
            } else {
                ForEach(satirlar) { s in
                    MaliyetSatiriGorunumu(satir: s)
                }
            }

            ForEach(viewModel.maliyet?.mudurlukToplamlari ?? []) { toplam in
                HStack {
                    Text(toplam.mudurluk).font(.caption)
                    Spacer()
                    Text(paraMetni(toplam.toplam))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KBTheme.navy)
                }
            }
        } header: {
            Text("İş Maliyeti (son 30 gün kapanan görevler)")
        }
    }

    private var genelToplamBolumu: some View {
        Section {
            if let ozet = viewModel.ozet {
                KBStatRow(
                    tiles: [
                        KBStat(label: "Toplam şikayet", value: "\(ozet.toplamSikayet)"),
                        KBStat(label: "Araç", value: "\(ozet.toplamArac)"),
                        KBStat(label: "Görev", value: "\(ozet.toplamGorev)"),
                    ]
                )
                HStack {
                    Text("Yakıt + Bakım").font(.caption).foregroundStyle(KBTheme.muted)
                    Spacer()
                    Text(paraMetni(ozet.yakitBakimToplam))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KBTheme.navy)
                }
            }
        }
    }

    // MARK: - Excel

    private var exportBolumu: some View {
        Section {
            ForEach(viewModel.exportlar) { kalem in
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(kalem.baslik).font(.subheadline)
                        if !kalem.izinli {
                            Text("Rolünüz bu dosyayı indiremiyor")
                                .font(.caption2)
                                .foregroundStyle(KBTheme.muted)
                        } else if kalem.tarihFiltreli {
                            Text("Son 90 gün")
                                .font(.caption2)
                                .foregroundStyle(KBTheme.muted)
                        }
                    }
                    Spacer(minLength: 0)
                    if viewModel.indirilenEntity == kalem.entity {
                        ProgressView()
                    } else {
                        Button("Excel İndir") {
                            Task { await viewModel.excelIndir(kalem) }
                        }
                        .font(.caption.bold())
                        .buttonStyle(.bordered)
                        .disabled(!kalem.izinli || viewModel.indirilenEntity != nil)
                    }
                }
                .frame(minHeight: KBTheme.touchMin)
            }
        } header: {
            Text("Excel Dışa Aktarma")
        } footer: {
            Text("İndirilen dosya paylaşım sayfasıyla Dosyalar'a kaydedilebilir.")
        }
    }

    // MARK: - Biçimleme

    /// Web `toFixed(1)` yerine gereksiz ",0" göstermez.
    private func gunMetni(_ gun: Double) -> String {
        gun == gun.rounded()
            ? String(Int(gun))
            : String(format: "%.1f", gun)
    }

    private func paraMetni(_ tutar: Double) -> String {
        let bicim = NumberFormatter()
        bicim.numberStyle = .decimal
        bicim.locale = Locale(identifier: "tr_TR")
        bicim.maximumFractionDigits = 0
        let sayi = bicim.string(from: NSNumber(value: tutar)) ?? "0"
        return "\(sayi) ₺"
    }
}

private struct DegerEtiketi: View {
    let baslik: String
    let deger: String

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(baslik).font(.caption2).foregroundStyle(KBTheme.muted)
            Text(deger).font(.caption.weight(.medium))
        }
    }
}

private struct MaliyetSatiriGorunumu: View {
    let satir: MaliyetSatiriDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(satir.gorevNo)
                    .font(.caption.monospaced())
                    .foregroundStyle(KBTheme.navy)
                Text(satir.plaka)
                    .font(.caption.monospaced())
                    .foregroundStyle(KBTheme.muted)
                Spacer(minLength: 0)
                Text(tutar(satir.maliyet.toplam))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KBTheme.navy)
            }

            if let tanim = satir.gorevTanimi {
                Text(tanim).font(.caption2).foregroundStyle(KBTheme.muted).lineLimit(1)
            }

            HStack(spacing: 10) {
                kalem("Yakıt", satir.maliyet.yakit, tahmini: satir.maliyet.yakitTahmini)
                kalem("Malzeme", satir.maliyet.malzeme)
                kalem("İşçilik", satir.maliyet.iscilik)
                kalem("Diğer", satir.maliyet.diger)
            }

            Text(satir.mudurluk).font(.caption2).foregroundStyle(KBTheme.muted)
        }
        .padding(.vertical, 2)
    }

    private func kalem(_ baslik: String, _ deger: Double, tahmini: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(tahmini ? "\(baslik) (tahmini)" : baslik)
                .font(.caption2)
                .foregroundStyle(KBTheme.muted)
            Text(tutar(deger)).font(.caption2.weight(.medium))
        }
    }

    private func tutar(_ deger: Double) -> String {
        let bicim = NumberFormatter()
        bicim.numberStyle = .decimal
        bicim.locale = Locale(identifier: "tr_TR")
        bicim.maximumFractionDigits = 0
        return (bicim.string(from: NSNumber(value: deger)) ?? "0") + " ₺"
    }
}
