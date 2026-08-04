import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@kars/db";
import {
  sikayetDurumGuncelle,
  sikayetAta,
  sikayetKonumGuncelle,
  sikayetMudurlukAta,
  sikayetPersonelAta,
} from "@/lib/actions/complaints";
import {
  ONCELIK_LABELS,
  SIKAYET_DURUM_LABELS,
  KANAL_LABELS,
} from "@kars/shared";
import { LocationPickerField } from "@/components/complaints/LocationPickerField";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionForm } from "@/components/ui/form/ActionForm";
import { FormInput, FormSelect } from "@/components/ui/form/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { canAccessComplaint, toAccessUser } from "@/lib/access";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  OLUSTURULDU: "Kayıt oluşturuldu",
  DURUM_DEGISTI: "Durum değiştirildi",
  GOREVLENDIRME: "Görevlendirme yapıldı",
  MUDURLUK_ATAMA: "Müdürlüğe yönlendirildi",
  KONUM_GUNCELLENDI: "Konum güncellendi",
  WHATSAPP_AUTO: "WhatsApp otomatik kayıt",
  WHATSAPP_ONAY: "WhatsApp onayı",
  NOT: "Not eklendi",
};

export default async function SikayetDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageAccess("/sikayetler");
  const { id } = await params;
  const s = await prisma.complaint.findUnique({
    where: { id },
    include: {
      neighborhood: true,
      complaintType: true,
      department: true,
      vehicle: { include: { atananSofor: true } },
      personel: { include: { personnel: true } },
      onaylayan: true,
      events: { orderBy: { createdAt: "desc" }, include: { user: true } },
      photos: true,
    },
  });
  if (!s || !canAccessComplaint(toAccessUser(session.user), s)) notFound();

  const rol = session.user.role;
  const mudurlukAtayabilir = rol === "ADMIN" || rol === "CALL_CENTER";
  const personelAtayabilir =
    rol === "ADMIN" ||
    (rol === "DEPARTMENT_MANAGER" && !!session.user.departmentId);

  const [araclar, personeller, mudurlukler, atanabilirPersonel] =
    await Promise.all([
      prisma.vehicle.findMany({
        where: { envanterDurumu: "AKTIF" },
        include: { atananSofor: true },
        orderBy: { plaka: "asc" },
      }),
      prisma.personnel.findMany({ where: { durum: "AKTIF" }, orderBy: { adSoyad: "asc" } }),
      mudurlukAtayabilir
        ? prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } })
        : Promise.resolve([]),
      personelAtayabilir
        ? prisma.personnel.findMany({
            where: {
              durum: "AKTIF",
              ...(rol === "DEPARTMENT_MANAGER"
                ? { departmentId: session.user.departmentId }
                : {}),
            },
            orderBy: { adSoyad: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const acikMi = s.durum === "ACIK" || s.durum === "DEVAM_EDIYOR";

  function Alan({ ad, deger }: { ad: string; deger?: string | null }) {
    return (
      <div>
        <div className="text-xs text-kb-muted">{ad}</div>
        <div className="text-sm">{deger || "—"}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={s.sikayetNo}
        description={`${s.arayanKisi} · ${KANAL_LABELS[s.kanal]}`}
        actions={
          <>
            <StatusBadge label={SIKAYET_DURUM_LABELS[s.durum]} />
            <StatusBadge label={ONCELIK_LABELS[s.oncelik]} />
            <Link href="/sikayetler" className="text-sm text-kb-muted hover:text-kb-ink">
              ← Liste
            </Link>
            <Link
              href={`/sikayetler/${s.id}/rapor`}
              className="rounded-md border border-kb-border px-4 py-2 text-sm text-kb-ink hover:bg-kb-surface"
            >
              İş Emri Raporu
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* ŞİKAYET BİLGİLERİ (Excel RAPORLAMA bölümleri) */}
          <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
            <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
              Şikayet Bilgileri
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Alan ad="Kayıt Tarihi" deger={s.kayitTarihi.toLocaleDateString("tr-TR")} />
              <Alan
                ad="Kayıt Saati"
                deger={s.kayitTarihi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              />
              <Alan ad="Kanal" deger={KANAL_LABELS[s.kanal]} />
              <Alan ad="Arayan Kişi" deger={s.arayanKisi} />
              <Alan ad="Telefon" deger={s.telefon} />
              <Alan ad="Şikayet Türü" deger={s.complaintType?.name} />
              <Alan ad="Yönlendirilen Müdürlük" deger={s.department?.name} />
              <Alan ad="Mahalle" deger={s.neighborhood?.name} />
              <Alan ad="Açık Adres" deger={s.acikAdres} />
              <Alan
                ad="Konum"
                deger={
                  s.lat != null && s.lng != null
                    ? `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`
                    : null
                }
              />
              {s.durum === "KAPATILDI" && (
                <>
                  <Alan ad="Kapanış Tarihi" deger={s.kapanisTarihi?.toLocaleDateString("tr-TR")} />
                  <Alan ad="Onaylayan" deger={s.onaylayan?.name} />
                  <Alan ad="Çözüm Notu" deger={s.cozumNotu} />
                </>
              )}
            </div>
            {s.aciklama && (
              <div className="mt-4 rounded-md bg-[#eef2f6] p-3 text-sm">
                {s.aciklama}
              </div>
            )}
          </section>

          {/* KONUM — manuel pin veya adresten bul */}
          {acikMi && (
            <section
              id="konum"
              className="rounded-lg border border-kb-border bg-white shadow-sm p-5 scroll-mt-24"
            >
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Konumu Güncelle
              </h2>
              <ActionForm action={sikayetKonumGuncelle} className="space-y-4">
                <input type="hidden" name="id" value={s.id} />
                {/* Adresten bul için mahalle/adres alanları (görünmez; mevcut kayıttan) */}
                <input type="hidden" name="acikAdres" value={s.acikAdres ?? ""} />
                <input
                  type="hidden"
                  name="neighborhoodId"
                  value={s.neighborhoodId ?? ""}
                />
                <LocationPickerField
                  initialLat={s.lat}
                  initialLng={s.lng}
                  mahalleler={
                    s.neighborhood
                      ? [{ id: s.neighborhood.id, name: s.neighborhood.name }]
                      : []
                  }
                />
                <div className="flex justify-end">
                  <SubmitButton>Konumu kaydet</SubmitButton>
                </div>
              </ActionForm>
            </section>
          )}

          {/* MÜDÜRLÜĞE YÖNLENDİRME (ADMIN / CALL_CENTER) */}
          {mudurlukAtayabilir && acikMi && (
            <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Müdürlüğe Yönlendir
              </h2>
              <ActionForm
                action={sikayetMudurlukAta}
                className="grid gap-3 md:grid-cols-3"
              >
                <input type="hidden" name="id" value={s.id} />
                <FormSelect
                  name="departmentId"
                  label="Müdürlük"
                  className="md:col-span-2"
                  placeholder="— Müdürlük yok —"
                  defaultValue={s.departmentId ?? ""}
                  options={mudurlukler.map((m) => ({ value: m.id, label: m.name }))}
                />
                <div className="flex items-end">
                  <SubmitButton className="w-full">Yönlendir</SubmitButton>
                </div>
              </ActionForm>
            </section>
          )}

          {/* PERSONELE ATAMA (ADMIN / MÜDÜR) */}
          {personelAtayabilir && acikMi && (
            <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Personele Ata
              </h2>
              <ActionForm
                action={sikayetPersonelAta}
                className="grid gap-3 md:grid-cols-3"
              >
                <input type="hidden" name="id" value={s.id} />
                <FormSelect
                  name="personnelIds"
                  label="Personel (birden fazla seçilebilir)"
                  className="md:col-span-2"
                  multiple
                  size={4}
                  options={atanabilirPersonel.map((p) => ({
                    value: p.id,
                    label: p.unvan ? `${p.adSoyad} — ${p.unvan}` : p.adSoyad,
                  }))}
                />
                <div className="flex items-end">
                  <SubmitButton className="w-full">Personele Ata</SubmitButton>
                </div>
              </ActionForm>
              {s.personel.length > 0 && (
                <p className="mt-3 text-xs text-kb-muted">
                  Atanmış: {s.personel.map((p) => p.personnel.adSoyad).join(", ")}
                </p>
              )}
            </section>
          )}

          {/* GÖREVLENDİRME */}
          <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
            <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
              Görevlendirme
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <Alan ad="Araç Plakası" deger={s.vehicle?.plaka} />
              <Alan ad="Şoför Adı" deger={s.soforAdi ?? s.vehicle?.atananSofor?.name} />
              <Alan ad="Şoför Telefonu" deger={s.soforTelefonu ?? s.vehicle?.atananSofor?.phone} />
              <Alan
                ad="Görevlendirilen Personel"
                deger={s.personel.map((p) => p.personnel.adSoyad).join(", ")}
              />
            </div>

            {acikMi && (
              <ActionForm
                action={sikayetAta}
                className="grid gap-3 border-t border-kb-border/60 pt-4 md:grid-cols-3"
              >
                <input type="hidden" name="id" value={s.id} />
                <FormSelect
                  name="vehicleId"
                  label="Araç (Plaka)"
                  placeholder="— Araç yok —"
                  defaultValue={s.vehicleId ?? ""}
                  options={araclar.map((a) => ({
                    value: a.id,
                    label: a.atananSofor
                      ? `${a.plaka} (${a.atananSofor.name})`
                      : a.plaka,
                  }))}
                />
                <FormSelect
                  name="personnelIds"
                  label="Personel"
                  multiple
                  size={3}
                  defaultValue={s.personel.map((p) => p.personnelId)}
                  options={personeller.map((p) => ({
                    value: p.id,
                    label: p.adSoyad,
                  }))}
                />
                <div className="flex items-end">
                  <SubmitButton className="w-full">Görevlendir</SubmitButton>
                </div>
              </ActionForm>
            )}
          </section>

          {/* DURUM GÜNCELLEME / KAPATMA */}
          {acikMi && (
            <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Durum Güncelle / Kapat
              </h2>
              <ActionForm
                action={sikayetDurumGuncelle}
                encType="multipart/form-data"
                className="grid gap-3 md:grid-cols-3"
              >
                <input type="hidden" name="id" value={s.id} />
                <FormSelect
                  name="durum"
                  label="Yeni Durum"
                  defaultValue={s.durum}
                  options={[
                    { value: "ACIK", label: "Açık" },
                    { value: "DEVAM_EDIYOR", label: "Devam Ediyor" },
                    { value: "KAPATILDI", label: "Kapatıldı" },
                    { value: "IPTAL", label: "İptal" },
                  ]}
                />
                <FormInput
                  name="cozumNotu"
                  label="Çözüm Notu"
                  hint="Kapatmada onaylayan olarak oturum sahibi kaydedilir."
                />
                <div>
                  <label className="mb-1 block text-xs text-kb-muted">
                    Çözüm görselleri
                  </label>
                  <input
                    type="file"
                    name="cozumFotolari"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="block w-full text-sm text-kb-muted file:mr-2 file:rounded-md file:border-0 file:bg-kb-navy file:px-3 file:py-1.5 file:text-xs file:text-white"
                  />
                  <p className="mt-1 text-xs text-kb-muted">
                    Kapatırken JPEG/PNG/WebP, en fazla 8 dosya.
                  </p>
                </div>
                <div className="flex items-end md:col-span-3">
                  <SubmitButton variant="success" size="md" className="w-full md:w-auto">
                    Güncelle
                  </SubmitButton>
                </div>
              </ActionForm>
            </section>
          )}

          {s.photos.length > 0 && (
            <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Görseller
              </h2>
              <div className="space-y-4">
                {(["VATANDAS", "COZUM"] as const).map((tip) => {
                  const grup = s.photos.filter((p) => p.tip === tip);
                  if (grup.length === 0) return null;
                  return (
                    <div key={tip}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-kb-muted">
                        {tip === "COZUM" ? "Çözüm görselleri" : "Vatandaş görselleri"}
                      </h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {grup.map((p) => (
                          <a
                            key={p.id}
                            href={`/api/ops/complaint-photo/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-md border border-kb-border"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/ops/complaint-photo/${p.id}`}
                              alt={tip === "COZUM" ? "Çözüm" : "Vatandaş"}
                              className="h-28 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ZAMAN ÇİZELGESİ (audit log) */}
        <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5 h-fit">
          <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
            İşlem Geçmişi
          </h2>
          <ol className="space-y-3">
            {s.events.map((e) => (
              <li key={e.id} className="text-sm border-l-2 border-blue-200 pl-3">
                <div className="font-medium">
                  {EVENT_LABELS[e.tip] ?? e.tip}
                </div>
                <div className="text-xs text-kb-muted">
                  {e.user?.name ?? "Sistem"} ·{" "}
                  {e.createdAt.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                </div>
                {e.detay != null && e.tip === "DURUM_DEGISTI" && (
                  <div className="text-xs text-kb-muted mt-0.5">
                    {(e.detay as { eski?: string }).eski} → {(e.detay as { yeni?: string }).yeni}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
