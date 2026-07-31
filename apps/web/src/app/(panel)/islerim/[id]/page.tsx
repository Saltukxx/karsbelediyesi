import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@kars/db";
import {
  ONCELIK_LABELS,
  SIKAYET_DURUM_LABELS,
  KANAL_LABELS,
} from "@kars/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requirePageAccess } from "@/lib/authz";
import { islerimSikayetDurum } from "@/lib/actions/islerim";
import { whatsappCevapGonder } from "@/lib/actions/whatsapp";

export const dynamic = "force-dynamic";

export default async function IslerimSikayetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageAccess("/islerim");
  const { id } = await params;

  const personel = await prisma.personnel.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!personel) notFound();

  const atama = await prisma.complaintPersonnel.findUnique({
    where: { complaintId_personnelId: { complaintId: id, personnelId: personel.id } },
  });
  if (!atama) notFound();

  const s = await prisma.complaint.findUnique({
    where: { id },
    include: {
      neighborhood: true,
      complaintType: true,
      department: true,
      photos: true,
    },
  });
  if (!s) notFound();

  // Konuşma geçmişi: şikayete bağlı mesajlar + aynı telefonun mesajları
  const mesajlar = await prisma.whatsAppMessage.findMany({
    where: {
      OR: [
        { complaintId: s.id },
        ...(s.telefon ? [{ telefon: s.telefon.replace(/\D/g, "") }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { sentByUser: { select: { name: true } } },
  });

  const acikMi = s.durum === "ACIK" || s.durum === "DEVAM_EDIYOR";
  const inputCls = "w-full rounded-md border border-kb-border px-3 py-2 text-sm";

  const GONDERIM_LABELS: Record<string, string> = {
    KUYRUKTA: "gönderiliyor",
    GONDERILDI: "iletildi",
    BASARISIZ: "iletilemedi",
  };

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
            <Link href="/islerim" className="text-sm text-kb-muted hover:text-kb-ink">
              ← İşlerim
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-lg border border-kb-border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase text-kb-muted">
              Şikayet Bilgileri
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Alan ad="Kayıt Tarihi" deger={s.kayitTarihi.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} />
              <Alan ad="Telefon" deger={s.telefon} />
              <Alan ad="Şikayet Türü" deger={s.complaintType?.name} />
              <Alan ad="Müdürlük" deger={s.department?.name} />
              <Alan ad="Mahalle" deger={s.neighborhood?.name} />
              <Alan ad="Açık Adres" deger={s.acikAdres} />
            </div>
            {s.aciklama && (
              <div className="mt-4 rounded-md bg-[#eef2f6] p-3 text-sm">{s.aciklama}</div>
            )}
          </section>

          {acikMi && (
            <section className="rounded-lg border border-kb-border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase text-kb-muted">
                Durum Güncelle
              </h2>
              <form action={islerimSikayetDurum} className="grid gap-3 md:grid-cols-3">
                <input type="hidden" name="id" value={s.id} />
                <div>
                  <label className="mb-1 block text-xs text-kb-muted">Yeni Durum</label>
                  <select name="durum" defaultValue={s.durum} className={inputCls}>
                    <option value="ACIK">Açık</option>
                    <option value="DEVAM_EDIYOR">Devam Ediyor</option>
                    <option value="KAPATILDI">Kapatıldı</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-kb-muted">
                    Çözüm Notu (kapatmada)
                  </label>
                  <input name="cozumNotu" className={inputCls} />
                </div>
                <div className="flex items-end">
                  <button className="w-full rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">
                    Güncelle
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>

        {/* WHATSAPP KONUŞMASI */}
        <section className="flex h-fit flex-col rounded-lg border border-kb-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase text-kb-muted">
            WhatsApp Konuşması
          </h2>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {mesajlar.length === 0 && (
              <p className="text-sm text-kb-muted">
                Bu şikayete bağlı WhatsApp mesajı yok.
              </p>
            )}
            {mesajlar.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.yon === "GELEN"
                    ? "bg-[#eef2f6] text-kb-ink"
                    : "ml-auto bg-kb-navy text-white"
                }`}
              >
                {m.icerik && <p className="whitespace-pre-wrap">{m.icerik}</p>}
                {m.medyaUrl && (
                  <p className="mt-1 text-xs opacity-75">📎 Medya eki ({m.medyaTipi})</p>
                )}
                <p
                  className={`mt-1 text-[10px] ${
                    m.yon === "GELEN" ? "text-kb-muted" : "text-white/70"
                  }`}
                >
                  {m.yon === "GIDEN" && m.sentByUser ? `${m.sentByUser.name} · ` : ""}
                  {m.createdAt.toLocaleString("tr-TR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                  {m.yon === "GIDEN" && m.gonderimDurumu
                    ? ` · ${GONDERIM_LABELS[m.gonderimDurumu] ?? m.gonderimDurumu}`
                    : ""}
                </p>
                {m.gonderimDurumu === "BASARISIZ" && (
                  <p className="mt-1 text-[10px] text-amber-200">
                    Mesaj iletilemedi — tekrar göndermeyi deneyin.
                  </p>
                )}
              </div>
            ))}
          </div>

          {s.telefon ? (
            <form action={whatsappCevapGonder} className="mt-4 space-y-2 border-t border-kb-border/60 pt-4">
              <input type="hidden" name="complaintId" value={s.id} />
              <label className="block text-xs text-kb-muted">
                Vatandaşa WhatsApp cevabı
              </label>
              <textarea
                name="text"
                rows={3}
                required
                maxLength={2000}
                placeholder="Mesajınızı yazın…"
                className={inputCls}
              />
              <button className="rounded-md bg-kb-navy px-4 py-2 text-sm text-white hover:bg-kb-navy-soft">
                Gönder
              </button>
              <p className="text-[11px] text-kb-muted">
                Mesaj, belediye WhatsApp hattı üzerinden vatandaşa iletilir.
              </p>
            </form>
          ) : (
            <p className="mt-4 border-t border-kb-border/60 pt-4 text-xs text-kb-muted">
              Şikayette telefon numarası olmadığı için WhatsApp cevabı gönderilemez.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
