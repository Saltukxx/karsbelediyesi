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

  const [araclar, personeller, onaylayanlar, mudurlukler, atanabilirPersonel] =
    await Promise.all([
      prisma.vehicle.findMany({
        where: { envanterDurumu: "AKTIF" },
        include: { atananSofor: true },
        orderBy: { plaka: "asc" },
      }),
      prisma.personnel.findMany({ where: { durum: "AKTIF" }, orderBy: { adSoyad: "asc" } }),
      prisma.user.findMany({ where: { role: { in: ["APPROVER", "ADMIN"] }, aktif: true } }),
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
  const inputCls =
    "w-full rounded-md border border-kb-border px-3 py-2 text-sm";

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
            <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Konumu Güncelle
              </h2>
              <form action={sikayetKonumGuncelle} className="space-y-4">
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
                  <button
                    type="submit"
                    className="rounded-md bg-kb-navy hover:bg-kb-navy-soft px-4 py-2 text-sm font-medium text-white"
                  >
                    Konumu kaydet
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* MÜDÜRLÜĞE YÖNLENDİRME (ADMIN / CALL_CENTER) */}
          {mudurlukAtayabilir && acikMi && (
            <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Müdürlüğe Yönlendir
              </h2>
              <form action={sikayetMudurlukAta} className="grid md:grid-cols-3 gap-3">
                <input type="hidden" name="id" value={s.id} />
                <div className="md:col-span-2">
                  <label className="text-xs text-kb-muted block mb-1">Müdürlük</label>
                  <select name="departmentId" defaultValue={s.departmentId ?? ""} className={inputCls}>
                    <option value="">— Müdürlük yok —</option>
                    {mudurlukler.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-4 py-2 text-sm w-full">
                    Yönlendir
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* PERSONELE ATAMA (ADMIN / MÜDÜR) */}
          {personelAtayabilir && acikMi && (
            <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Personele Ata
              </h2>
              <form action={sikayetPersonelAta} className="grid md:grid-cols-3 gap-3">
                <input type="hidden" name="id" value={s.id} />
                <div className="md:col-span-2">
                  <label className="text-xs text-kb-muted block mb-1">
                    Personel (birden fazla seçilebilir)
                  </label>
                  <select name="personnelIds" multiple size={4} className={inputCls}>
                    {atanabilirPersonel.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.adSoyad}{p.unvan ? ` — ${p.unvan}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-4 py-2 text-sm w-full">
                    Personele Ata
                  </button>
                </div>
              </form>
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
              <form action={sikayetAta} className="border-t border-kb-border/60 pt-4 grid md:grid-cols-3 gap-3">
                <input type="hidden" name="id" value={s.id} />
                <div>
                  <label className="text-xs text-kb-muted block mb-1">Araç (Plaka)</label>
                  <select name="vehicleId" defaultValue={s.vehicleId ?? ""} className={inputCls}>
                    <option value="">— Araç yok —</option>
                    {araclar.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.plaka}{a.atananSofor ? ` (${a.atananSofor.name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-kb-muted block mb-1">Personel</label>
                  <select
                    name="personnelIds"
                    multiple
                    size={3}
                    defaultValue={s.personel.map((p) => p.personnelId)}
                    className={inputCls}
                  >
                    {personeller.map((p) => (
                      <option key={p.id} value={p.id}>{p.adSoyad}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-4 py-2 text-sm w-full">
                    Görevlendir
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* DURUM GÜNCELLEME / KAPATMA */}
          {acikMi && (
            <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5">
              <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink mb-4">
                Durum Güncelle / Kapat
              </h2>
              <form action={sikayetDurumGuncelle} className="grid md:grid-cols-4 gap-3">
                <input type="hidden" name="id" value={s.id} />
                <div>
                  <label className="text-xs text-kb-muted block mb-1">Yeni Durum</label>
                  <select name="durum" defaultValue={s.durum} className={inputCls}>
                    <option value="ACIK">Açık</option>
                    <option value="DEVAM_EDIYOR">Devam Ediyor</option>
                    <option value="KAPATILDI">Kapatıldı</option>
                    <option value="IPTAL">İptal</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-kb-muted block mb-1">
                    Onaylayan (kapatmada)
                  </label>
                  <select name="onaylayanId" defaultValue="" className={inputCls}>
                    <option value="">— Seçiniz —</option>
                    {onaylayanlar.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-kb-muted block mb-1">Çözüm Notu</label>
                  <input name="cozumNotu" className={inputCls} />
                </div>
                <div className="flex items-end">
                  <button className="rounded-md bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm w-full">
                    Güncelle
                  </button>
                </div>
              </form>
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
