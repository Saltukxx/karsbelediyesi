import { prisma } from "@kars/db";
import { sikayetOlustur } from "@/lib/actions/complaints";
import { ONCELIK_LABELS } from "@kars/shared";
import Link from "next/link";
import { LocationPickerField } from "@/components/complaints/LocationPickerField";
import { ActionForm } from "@/components/ui/form/ActionForm";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/form/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonCls } from "@/lib/ui";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function YeniSikayetPage() {
  await requirePageAccess("/sikayetler");
  const [mahalleler, turler, mudurlukler, araclar, personeller] = await Promise.all([
    prisma.neighborhood.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.complaintType.findMany({ where: { aktif: true }, include: { defaultDepartment: true } }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({
      where: { envanterDurumu: "AKTIF" },
      include: { atananSofor: true },
      orderBy: { plaka: "asc" },
    }),
    prisma.personnel.findMany({ where: { durum: "AKTIF" }, orderBy: { adSoyad: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/sikayetler" className="text-kb-muted hover:text-kb-ink">←</Link>
        <h1 className="font-brand text-2xl font-semibold tracking-tight text-kb-navy">
          Yeni Şikayet Kaydı
        </h1>
      </div>
      <p className="text-sm text-kb-muted">
        Şikayet numarası otomatik verilir. Tür seçildiğinde müdürlük otomatik önerilir;
        plaka seçildiğinde şoför bilgisi zimmetten gelir.
      </p>

      <ActionForm
        action={sikayetOlustur}
        className="space-y-5 rounded-lg border border-kb-border bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput name="arayanKisi" label="Arayan Kişi" required />
          <FormInput
            name="telefon"
            label="Telefon"
            type="tel"
            placeholder="05xxxxxxxxx"
          />
          <FormSelect
            name="neighborhoodId"
            label="Mahalle"
            placeholder="— Seçiniz —"
            options={mahalleler.map((m) => ({ value: m.id, label: m.name }))}
          />
          <FormInput name="acikAdres" label="Açık Adres" />
          <FormSelect
            name="complaintTypeId"
            label="Şikayet Türü"
            placeholder="— Seçiniz —"
            options={turler.map((t) => ({
              value: t.id,
              label: t.defaultDepartment
                ? `${t.name} → ${t.defaultDepartment.name}`
                : t.name,
            }))}
          />
          <FormSelect
            name="departmentId"
            label="Yönlendirilen Müdürlük"
            placeholder="— Türe göre otomatik —"
            options={mudurlukler.map((m) => ({ value: m.id, label: m.name }))}
          />
          <FormSelect
            name="oncelik"
            label="Öncelik"
            defaultValue="NORMAL"
            options={Object.entries(ONCELIK_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <FormSelect
            name="vehicleId"
            label="Görevlendirilen Araç (Plaka)"
            placeholder="— Sonra atanabilir —"
            options={araclar.map((a) => ({
              value: a.id,
              label: a.atananSofor
                ? `${a.plaka} (Şoför: ${a.atananSofor.name})`
                : a.plaka,
            }))}
          />
        </div>

        <FormTextarea name="aciklama" label="Açıklama" rows={3} />

        <LocationPickerField mahalleler={mahalleler} />

        <FormSelect
          name="personnelIds"
          label="Görevlendirilen Personel"
          multiple
          size={5}
          hint="Cmd/Ctrl ile birden fazla seçilebilir."
          options={personeller.map((p) => ({
            value: p.id,
            label: p.unvan ? `${p.adSoyad} — ${p.unvan}` : p.adSoyad,
          }))}
        />

        <div className="flex justify-end gap-2">
          <Link href="/sikayetler" className={buttonCls("secondary", "md")}>
            Vazgeç
          </Link>
          <SubmitButton>Kaydet</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
