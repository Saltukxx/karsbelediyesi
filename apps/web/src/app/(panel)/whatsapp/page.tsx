import { prisma } from "@kars/db";
import { ONCELIK_LABELS } from "@kars/shared";
import { whatsappOnayla, whatsappReddet } from "@/lib/actions/whatsapp";
import { inputCls, btnPrimary, btnSecondary, cardCls } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RowActions, RowActionLink } from "@/components/ui/RowActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { WhatsAppQueueLive } from "@/components/whatsapp/WhatsAppQueueLive";
import { getBotStatus } from "@/lib/bot-status";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  await requirePageAccess("/whatsapp");
  const [pending, recent, status, turler, mahalleler] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where: { onayDurumu: "ONAY_BEKLIYOR", yon: "GELEN" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.whatsAppMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { complaint: true },
    }),
    getBotStatus(),
    prisma.complaintType.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.neighborhood.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <PageHeader
            title="WhatsApp Kuyruğu"
            description="AI sınıflandırması düşük güvenli mesajlar burada onaylanır."
          />
          <WhatsAppQueueLive initialCount={pending.length} />
        </div>
        <div className={`${cardCls} max-w-sm px-4 py-3 text-sm`}>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${status.connected ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <span className="font-medium">
              {status.connected ? "Bağlı" : "Bağlı değil"}
            </span>
          </div>
          <p className="text-kb-muted mt-1">{status.note}</p>
          {status.lastSeen && (
            <p className="text-xs text-kb-muted mt-1">Son: {status.lastSeen}</p>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">
          Onay Bekleyen ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className={cardCls}>
            <EmptyState
              title="Kuyruk boş"
              description="Onay bekleyen WhatsApp mesajı yok."
            />
          </div>
        ) : (
          pending.map((m) => {
            const ai = (m.aiSonuc ?? {}) as Record<string, unknown>;
            return (
              <div key={m.id} className={`${cardCls} group space-y-3 p-4`}>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <div>
                    <span className="font-mono">{m.telefon}</span>
                    <span className="ml-2 text-kb-muted">
                      {m.createdAt.toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-kb-muted">
                    <StatusBadge label="Onay bekliyor" />
                    <span>
                      Güven: {m.guven != null ? `${(m.guven * 100).toFixed(0)}%` : "—"} ·{" "}
                      {String(ai.intent ?? "—")}
                    </span>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.icerik}</p>
                {m.medyaUrl && m.medyaTipi === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/ops/whatsapp-media/${m.id}`}
                    alt="WhatsApp fotoğraf"
                    className="max-h-56 max-w-full rounded-md border border-kb-border object-contain"
                  />
                )}
                {m.medyaUrl && m.medyaTipi === "audio" && (
                  <audio
                    controls
                    preload="metadata"
                    src={`/api/ops/whatsapp-media/${m.id}`}
                    className="w-full max-w-md"
                  />
                )}
                <form action={whatsappOnayla} className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <input type="hidden" name="id" value={m.id} />
                  <div>
                    <label className="text-xs text-kb-muted block mb-1">Şikayet Türü</label>
                    <select
                      name="sikayetTuru"
                      defaultValue={String(ai.sikayet_turu ?? "")}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {turler.map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-kb-muted block mb-1">Mahalle</label>
                    <select
                      name="mahalle"
                      defaultValue={String(ai.mahalle ?? "")}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {mahalleler.map((n) => (
                        <option key={n.id} value={n.name}>{n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-kb-muted block mb-1">Öncelik</label>
                    <select
                      name="oncelik"
                      defaultValue={String(ai.oncelik ?? "NORMAL")}
                      className={inputCls}
                    >
                      {Object.entries(ONCELIK_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-kb-muted block mb-1">Adres</label>
                    <input
                      name="adres"
                      defaultValue={String(ai.adres ?? "")}
                      className={inputCls}
                    />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="text-xs text-kb-muted block mb-1">Açıklama</label>
                    <input
                      name="aciklama"
                      defaultValue={String(ai.aciklama_ozeti ?? m.icerik ?? "")}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className={btnPrimary}>Onayla → Şikayet</button>
                  </div>
                </form>
                <form action={whatsappReddet}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className={btnSecondary}>Reddet</button>
                </form>
              </div>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Son Yazışmalar</h2>
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Zaman</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Yön</th>
                <th className="p-3">İçerik</th>
                <th className="p-3">Medya</th>
                <th className="p-3">Onay</th>
                <th className="p-3">Şikayet</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id} className="group border-b border-kb-border/60">
                  <td className="whitespace-nowrap p-3 text-kb-muted">
                    {m.createdAt.toLocaleString("tr-TR")}
                  </td>
                  <td className="p-3 font-mono">{m.telefon}</td>
                  <td className="p-3">{m.yon}</td>
                  <td className="max-w-xs truncate p-3">{m.icerik}</td>
                  <td className="p-3 text-kb-muted">
                    {m.medyaUrl && m.medyaTipi === "image" ? (
                      <a
                        href={`/api/ops/whatsapp-media/${m.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-kb-navy hover:underline"
                      >
                        Fotoğraf
                      </a>
                    ) : m.medyaUrl && m.medyaTipi === "audio" ? (
                      <a
                        href={`/api/ops/whatsapp-media/${m.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-kb-navy hover:underline"
                      >
                        Ses
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    {m.onayDurumu ? (
                      <StatusBadge
                        label={
                          m.onayDurumu === "ONAY_BEKLIYOR"
                            ? "Onay bekliyor"
                            : m.onayDurumu === "ONAYLANDI"
                              ? "Onaylandı"
                              : m.onayDurumu === "REDDEDILDI"
                                ? "Reddedildi"
                                : m.onayDurumu === "OTOMATIK"
                                  ? "Otomatik"
                                  : m.onayDurumu
                        }
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      {m.complaint ? (
                        <Link
                          href={`/sikayetler/${m.complaint.id}`}
                          className="font-mono text-xs text-kb-navy hover:underline"
                        >
                          {m.complaint.sikayetNo}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {m.complaint && (
                        <RowActions>
                          <RowActionLink href={`/sikayetler/${m.complaint.id}`}>
                            Detay
                          </RowActionLink>
                        </RowActions>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
