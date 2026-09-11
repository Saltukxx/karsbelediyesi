import SwiftUI
import UIKit

struct ComplaintDetailView: View {
    let complaintId: String
    @EnvironmentObject private var session: AppSession
    @StateObject private var viewModel = ComplaintsViewModel()
    @State private var cozumNotu = ""
    @State private var selectedStatus: ComplaintStatus = .DEVAM_EDIYOR
    @State private var images: [UIImage] = []
    @State private var departmentId = ""
    @State private var vehicleId = ""
    @State private var selectedPersonnel: Set<String> = []
    @State private var mudurlukler: [NamedRefDTO] = []
    @State private var araclar: [VehicleDTO] = []
    @State private var personeller: [PersonnelDTO] = []
    @State private var kaydetHatasi: String?
    @State private var secenekHatasi: String?
    @State private var fotoHazirlaniyor = false
    @State private var raporHazirlaniyor = false
    @State private var paylasilacakRapor: KBExportFile?
    @Environment(\.dismiss) private var dismiss

    private var rol: UserRole? { session.user?.role }
    /// Web ile aynı: müdürlük ataması ADMIN / CALL_CENTER.
    private var mudurlukAtayabilir: Bool {
        rol == .ADMIN || rol == .CALL_CENTER
    }
    /// Web ile aynı: personel/araç ataması ADMIN veya DEPARTMENT_MANAGER.
    private var gorevlendirmeAtayabilir: Bool {
        rol == .ADMIN || (rol == .DEPARTMENT_MANAGER && session.user?.departmentId != nil)
    }
    private var atamaYapabilir: Bool { mudurlukAtayabilir || gorevlendirmeAtayabilir }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let error = viewModel.errorMessage {
                    ErrorBanner(message: error)
                }

                if let complaint = viewModel.selected {
                    header(for: complaint)
                    detailCard(for: complaint)
                    assignmentCard(for: complaint)
                    updateCard
                } else if !viewModel.isLoading {
                    EmptyStateView(title: "Şikayet bulunamadı", systemImage: "phone")
                }
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .kbScreenBackground()
        .kbNavigationChrome(title: viewModel.selected?.sikayetNo ?? "Detay")
        .task {
            await viewModel.loadDetail(id: complaintId)
            hydrateFromSelected()
            await secenekleriYukle()
        }
        .overlay {
            if viewModel.isLoading && viewModel.selected == nil { LoadingOverlay() }
        }
        .sheet(item: $paylasilacakRapor) { dosya in
            KBShareSheet(items: [dosya.url])
        }
    }

    private func header(for complaint: ComplaintDTO) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(complaint.arayanKisi ?? "—")
                .font(.title3.weight(.bold))
                .foregroundStyle(KBTheme.navy)

            HStack(spacing: 8) {
                if let durum = complaint.durum {
                    StatusBadge(text: durum.label, tone: durum.badgeTone)
                }
                if let oncelik = complaint.oncelik {
                    StatusBadge(text: oncelik.label, tone: oncelik.badgeTone)
                }
                Spacer()
            }

            if let telefon = complaint.telefon, !telefon.isEmpty {
                Button {
                    let digits = telefon.filter { $0.isNumber || $0 == "+" }
                    if let url = URL(string: "tel:\(digits)") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Label(telefon, systemImage: "phone.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KBTheme.accent)
                        .frame(minHeight: KBTheme.touchMin)
                }
                .buttonStyle(.plain)
            }

            Button {
                Task { await raporPaylas(complaint) }
            } label: {
                if raporHazirlaniyor {
                    ProgressView()
                } else {
                    Label("İş Emri Raporu", systemImage: "square.and.arrow.up")
                }
            }
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity, minHeight: KBTheme.touchMin)
            .foregroundStyle(KBTheme.navy)
            .background(KBTheme.background)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
            .disabled(raporHazirlaniyor)
            .accessibilityIdentifier("sikayetRaporPaylas")
        }
        .kbCard()
    }

    private func detailCard(for complaint: ComplaintDTO) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeaderLabel(title: "Kayıt Bilgisi")
            detailRow("Mahalle", complaint.neighborhood?.name)
            detailRow("Adres", complaint.acikAdres)
            detailRow("Tür", complaint.complaintType?.name)
            detailRow("Müdürlük", complaint.department?.name)
            detailRow("Açıklama", complaint.aciklama)
            detailRow("Araç", complaint.vehicle?.plaka)
            let personelAdlari = (complaint.personnel ?? [])
                .compactMap { $0.name }
                .filter { !$0.isEmpty }
            if !personelAdlari.isEmpty {
                detailRow("Personel", personelAdlari.joined(separator: ", "))
            }
            if let not = complaint.cozumNotu, !not.isEmpty {
                detailRow("Çözüm Notu", not)
            }
        }
        .kbCard()
    }

    @ViewBuilder
    private func assignmentCard(for complaint: ComplaintDTO) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeaderLabel(
                title: "Görevlendirme",
                subtitle: atamaYapabilir ? "Müdürlük, araç ve personel ataması" : "Salt okunur — atama yetkiniz yok"
            )
            .accessibilityIdentifier("sikayetGorevlendirme")

            if let secenekHatasi {
                ErrorBanner(message: secenekHatasi)
            }

            if mudurlukAtayabilir {
                KBFormPicker(
                    title: "Müdürlük",
                    selection: $departmentId,
                    options: [KBPickerOption(value: "", label: "— Seçilmedi —")]
                        + mudurlukler.map { KBPickerOption(value: $0.id, label: $0.name ?? $0.id) }
                )
            } else {
                detailRow("Müdürlük", complaint.department?.name)
            }

            if gorevlendirmeAtayabilir {
                KBFormPicker(
                    title: "Araç",
                    selection: $vehicleId,
                    options: [KBPickerOption(value: "", label: "— Seçilmedi —")]
                        + araclar.map { KBPickerOption(value: $0.id, label: $0.plaka ?? $0.id) }
                )

                VStack(alignment: .leading, spacing: 8) {
                    FormFieldLabel(title: "Personel")
                    if personeller.isEmpty {
                        Text(secenekHatasi == nil ? "Atanabilir personel listesi boş." : "Personel listesi yüklenemedi.")
                            .font(.caption)
                            .foregroundStyle(KBTheme.muted)
                    } else {
                        ForEach(personeller) { p in
                            let secili = selectedPersonnel.contains(p.id)
                            Button {
                                if secili { selectedPersonnel.remove(p.id) }
                                else { selectedPersonnel.insert(p.id) }
                            } label: {
                                HStack {
                                    Image(systemName: secili ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(secili ? KBTheme.action : KBTheme.muted)
                                    Text(p.adSoyad ?? p.id)
                                        .font(.subheadline)
                                        .foregroundStyle(KBTheme.navy)
                                    Spacer()
                                }
                                .frame(minHeight: 36)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            } else {
                detailRow("Araç", complaint.vehicle?.plaka)
                let adlar = (complaint.personnel ?? []).compactMap(\.name).joined(separator: ", ")
                detailRow("Personel", adlar.isEmpty ? nil : adlar)
            }
        }
        .kbCard()
    }

    private var updateCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeaderLabel(title: "Durum Güncelle", subtitle: "Değişiklik kayda işlenir")

            Picker("Durum", selection: $selectedStatus) {
                ForEach(ComplaintStatus.allCases, id: \.self) { status in
                    Text(status.label).tag(status)
                }
            }
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .frame(minHeight: KBTheme.touchMin)
            .background(KBTheme.background)
            .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))

            TextField("Çözüm notu (opsiyonel)", text: $cozumNotu, axis: .vertical)
                .lineLimit(3...8)
                .padding(12)
                .frame(minHeight: 88, alignment: .topLeading)
                .background(KBTheme.background)
                .clipShape(RoundedRectangle(cornerRadius: KBTheme.radiusSm))
                .overlay(
                    RoundedRectangle(cornerRadius: KBTheme.radiusSm)
                        .stroke(KBTheme.border, lineWidth: 1)
                )

            if selectedStatus == .KAPATILDI {
                KBImageSourcePicker(images: $images, title: "Kapanış fotoğrafı")
            }

            if let kaydetHatasi {
                ErrorBanner(message: kaydetHatasi)
            }

            Button {
                Task { await kaydet() }
            } label: {
                if fotoHazirlaniyor {
                    Label("Fotoğraflar hazırlanıyor", systemImage: "photo")
                } else if viewModel.isSaving {
                    ProgressView().tint(.white)
                } else {
                    Text("Kaydet")
                }
            }
            .buttonStyle(KBPrimaryButtonStyle())
            .disabled(viewModel.isSaving || fotoHazirlaniyor)
        }
        .kbCard()
    }


    private func raporPaylas(_ complaint: ComplaintDTO) async {
        raporHazirlaniyor = true
        kaydetHatasi = nil
        defer { raporHazirlaniyor = false }
        do {
            let data = try await APIClient.shared.exportComplaintRapor(id: complaint.id)
            let ad = (complaint.sikayetNo ?? complaint.id).replacingOccurrences(of: "/", with: "-")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(ad)-rapor.html")
            try data.write(to: url)
            paylasilacakRapor = KBExportFile(url: url)
        } catch is CancellationError {
        } catch {
            kaydetHatasi = KBErrorText.of(error)
        }
    }

    private func hydrateFromSelected() {
        guard let complaint = viewModel.selected else { return }
        if let status = complaint.durum { selectedStatus = status }
        cozumNotu = complaint.cozumNotu ?? ""
        departmentId = complaint.departmentId ?? ""
        vehicleId = complaint.vehicleId ?? ""
        selectedPersonnel = Set(complaint.personnelIds ?? complaint.personnel?.map(\.id) ?? [])
    }

    private func secenekleriYukle() async {
        secenekHatasi = nil
        do {
            if mudurlukAtayabilir {
                let lookups = try await KBReferenceCache.shared.lookups()
                mudurlukler = lookups.mudurlukler ?? []
                if mudurlukler.isEmpty {
                    secenekHatasi = "Müdürlük listesi boş."
                }
            }
            if gorevlendirmeAtayabilir {
                let aracSonuc = await KBOptionLoad.araclar()
                araclar = aracSonuc.liste.filter { $0.envanterDurumu?.uppercased() != "HURDAYA_AYRILDI" }
                if let h = aracSonuc.hata { secenekHatasi = h }

                let persSonuc = await KBOptionLoad.personel()
                personeller = persSonuc.liste.filter { p in
                    p.durum?.uppercased() != "PASIF" && p.durum?.uppercased() != "AYRILDI"
                }
                if let h = persSonuc.hata {
                    secenekHatasi = [secenekHatasi, h].compactMap { $0 }.joined(separator: " ")
                } else if personeller.isEmpty {
                    secenekHatasi = [secenekHatasi, "Atanabilir personel yok."].compactMap { $0 }.joined(separator: " ")
                }
            }
        } catch is CancellationError {
        } catch {
            secenekHatasi = KBErrorText.of(error)
        }
    }

    private func kaydet() async {
        kaydetHatasi = nil

        let photos: [String]
        do {
            fotoHazirlaniyor = !images.isEmpty
            defer { fotoHazirlaniyor = false }
            photos = try await KBPhotoUpload.dataURLs(from: images)
        } catch is CancellationError {
            return
        } catch {
            kaydetHatasi = KBErrorText.of(error)
            return
        }

        var body = UpdateComplaintFullDTO(
            durum: selectedStatus,
            cozumNotu: cozumNotu.isEmpty ? nil : cozumNotu,
            lat: viewModel.selected?.lat,
            lng: viewModel.selected?.lng,
            cozumFotolari: photos.isEmpty ? nil : photos
        )
        if mudurlukAtayabilir {
            body.departmentId = departmentId.isEmpty ? nil : departmentId
        }
        if gorevlendirmeAtayabilir {
            body.vehicleId = vehicleId.isEmpty ? nil : vehicleId
            body.personnelIds = Array(selectedPersonnel)
        }

        do {
            _ = try await APIClient.shared.updateComplaintFull(id: complaintId, body: body)
            dismiss()
            return
        } catch {
            guard APIClient.shared.isMissingEndpoint(error) else {
                kaydetHatasi = KBErrorText.of(error)
                return
            }
        }
        let ok = await viewModel.update(
            id: complaintId,
            request: UpdateComplaintRequestDTO(
                durum: selectedStatus,
                cozumNotu: cozumNotu.isEmpty ? nil : cozumNotu,
                lat: viewModel.selected?.lat,
                lng: viewModel.selected?.lng
            )
        )
        if ok {
            dismiss()
        } else {
            kaydetHatasi = viewModel.errorMessage ?? "Kayıt güncellenemedi."
        }
    }

    private func detailRow(_ title: String, _ value: String?) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(KBTheme.muted)
            Text((value?.isEmpty == false) ? value! : "—")
                .font(.subheadline)
                .foregroundStyle(KBTheme.navy)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
