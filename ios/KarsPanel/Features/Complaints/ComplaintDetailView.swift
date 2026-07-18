import SwiftUI
import UIKit

struct ComplaintDetailView: View {
    let complaintId: String
    @StateObject private var viewModel = ComplaintsViewModel()
    @State private var cozumNotu = ""
    @State private var selectedStatus: ComplaintStatus = .DEVAM_EDIYOR
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let error = viewModel.errorMessage {
                    ErrorBanner(message: error)
                }

                if let complaint = viewModel.selected {
                    header(for: complaint)
                    detailCard(for: complaint)
                    updateCard
                } else if !viewModel.isLoading {
                    EmptyStateView(title: "Şikayet bulunamadı", systemImage: "phone")
                }
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .kbScreenBackground()
        .navigationTitle(viewModel.selected?.sikayetNo ?? "Detay")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadDetail(id: complaintId)
            if let status = viewModel.selected?.durum {
                selectedStatus = status
            }
            cozumNotu = viewModel.selected?.cozumNotu ?? ""
        }
        .overlay {
            if viewModel.isLoading && viewModel.selected == nil { LoadingOverlay() }
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
            if let not = complaint.cozumNotu, !not.isEmpty {
                detailRow("Çözüm Notu", not)
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

            Button {
                Task {
                    let ok = await viewModel.update(
                        id: complaintId,
                        request: UpdateComplaintRequestDTO(
                            durum: selectedStatus,
                            cozumNotu: cozumNotu.isEmpty ? nil : cozumNotu,
                            lat: nil,
                            lng: nil
                        )
                    )
                    if ok { dismiss() }
                }
            } label: {
                if viewModel.isSaving {
                    ProgressView().tint(.white)
                } else {
                    Text("Kaydet")
                }
            }
            .buttonStyle(KBPrimaryButtonStyle())
            .disabled(viewModel.isSaving)
        }
        .kbCard()
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
