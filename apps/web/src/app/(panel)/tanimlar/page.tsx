import { prisma } from "@kars/db";
import { ROL_LABELS } from "@kars/shared";
import {
  mahalleOlustur,
  mudurlukOlustur,
  mudurlukGuncelle,
  sikayetTuruOlustur,
  sikayetTuruGuncelle,
  aracCinsiOlustur,
  kullaniciOlustur,
  kullaniciGuncelle,
} from "@/lib/actions/definitions";
import { otomatikAtamaKaydet } from "@/lib/actions/dispatch";
import { otomatikAtamaAcikMi } from "@/lib/dispatch";
import { inputCls, btnPrimary, btnSecondary, cardCls } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function TanimlarPage() {
  await requirePageAccess("/tanimlar");
  const [mahalleler, mudurlukler, turler, aracCinsleri, kullanicilar, otomatikAtama] = await Promise.all([
    prisma.neighborhood.findMany({ orderBy: { name: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.complaintType.findMany({
      orderBy: { name: "asc" },
      include: { defaultDepartment: true },
    }),
    prisma.vehicleType.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: { department: true },
    }),
    otomatikAtamaAcikMi(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Tanımlar & Yönetim" />
        <p className="text-sm text-kb-muted">
          Mahalle, müdürlük, şikayet türü (→müdürlük eşleme), araç cinsi, kullanıcı/rol.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Akıllı Dispatch</h2>
        <form action={otomatikAtamaKaydet} className={`${cardCls} p-4 space-y-3 max-w-xl`}>
          <label className="flex items-start gap-2 text-sm text-kb-ink">
            <input
              type="checkbox"
              name="otomatikAtama"
              defaultChecked={otomatikAtama}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">Tam otomatik atama</span>
              <span className="block text-xs text-kb-muted">
                Açıkken geciken kış / çöp rotaları için en yakın müsait araç öneri
                beklenmeden göreve atanır. Kapalıyken öneriler /kis ve /cop
                sayfalarındaki &quot;Bekleyen görevler&quot; panelinde onay bekler.
              </span>
            </span>
          </label>
          <button className={btnPrimary}>Kaydet</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Mahalleler ({mahalleler.length})</h2>
        <form action={mahalleOlustur} className="flex gap-2 max-w-md">
          <input name="name" required placeholder="Yeni mahalle" className={inputCls} />
          <button className={btnPrimary}>Ekle</button>
        </form>
        <div className={`${cardCls} p-4 flex flex-wrap gap-2`}>
          {mahalleler.map((m) => (
            <span
              key={m.id}
              className={`text-xs px-2 py-1 rounded ${m.aktif ? "bg-kb-surface" : "bg-red-50 text-red-600"}`}
            >
              {m.name}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Müdürlükler</h2>
        <form action={mudurlukOlustur} className={`${cardCls} p-4 grid md:grid-cols-3 gap-3 items-end`}>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Ad *</label>
            <input name="name" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Kısa Ad</label>
            <input name="shortName" placeholder="Su ve Kan." className={inputCls} />
          </div>
          <button className={btnPrimary}>+ Müdürlük</button>
        </form>
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Ad</th>
                <th className="p-3">Kısa Ad</th>
                <th className="p-3">Aktif</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {mudurlukler.map((m) => (
                <tr key={m.id} className="border-b border-kb-border/60">
                  <td className="p-3" colSpan={4}>
                    <form action={mudurlukGuncelle} className="grid md:grid-cols-4 gap-2 items-center">
                      <input type="hidden" name="id" value={m.id} />
                      <input name="name" defaultValue={m.name} className={inputCls} />
                      <input name="shortName" defaultValue={m.shortName} className={inputCls} />
                      <label className="text-sm flex items-center gap-2">
                        <input type="checkbox" name="aktif" defaultChecked={m.aktif} /> Aktif
                      </label>
                      <button className={btnSecondary}>Kaydet</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Şikayet Türleri → Müdürlük</h2>
        <form action={sikayetTuruOlustur} className={`${cardCls} p-4 grid md:grid-cols-3 gap-3 items-end`}>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Tür *</label>
            <input name="name" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Varsayılan Müdürlük</label>
            <select name="defaultDepartmentId" className={inputCls}>
              <option value="">—</option>
              {mudurlukler.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <button className={btnPrimary}>+ Tür</button>
        </form>
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm">
            <tbody>
              {turler.map((t) => (
                <tr key={t.id} className="border-b border-kb-border/60">
                  <td className="p-3">
                    <form action={sikayetTuruGuncelle} className="grid md:grid-cols-4 gap-2 items-center">
                      <input type="hidden" name="id" value={t.id} />
                      <input name="name" defaultValue={t.name} className={inputCls} />
                      <select
                        name="defaultDepartmentId"
                        defaultValue={t.defaultDepartmentId ?? ""}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {mudurlukler.map((m) => (
                          <option key={m.id} value={m.id}>{m.shortName || m.name}</option>
                        ))}
                      </select>
                      <label className="text-sm flex items-center gap-2">
                        <input type="checkbox" name="aktif" defaultChecked={t.aktif} /> Aktif
                      </label>
                      <button className={btnSecondary}>Kaydet</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Araç Cinsleri</h2>
        <form action={aracCinsiOlustur} className="flex gap-2 max-w-md">
          <input name="name" required placeholder="Yeni araç cinsi" className={inputCls} />
          <button className={btnPrimary}>Ekle</button>
        </form>
        <div className={`${cardCls} p-4 flex flex-wrap gap-2`}>
          {aracCinsleri.map((a) => (
            <span key={a.id} className="text-xs px-2 py-1 rounded bg-kb-surface">
              {a.name}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Kullanıcılar & Roller</h2>
        <form action={kullaniciOlustur} className={`${cardCls} p-4 grid md:grid-cols-3 lg:grid-cols-6 gap-3 items-end`}>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Ad *</label>
            <input name="name" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Telefon *</label>
            <input name="phone" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">E-posta</label>
            <input name="email" type="email" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Rol *</label>
            <select name="role" required className={inputCls}>
              {Object.entries(ROL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Müdürlük</label>
            <select name="departmentId" className={inputCls}>
              <option value="">—</option>
              {mudurlukler.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Şifre</label>
            <input name="password" type="password" placeholder="123456" className={inputCls} />
          </div>
          <button className={`${btnPrimary} lg:col-span-6 md:col-span-3`}>+ Kullanıcı</button>
        </form>

        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Ad</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Müdürlük</th>
                <th className="p-3">Aktif</th>
                <th className="p-3">Son Giriş</th>
                <th className="p-3">Yeni Şifre</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {kullanicilar.map((u) => (
                <tr key={u.id} className="border-b border-kb-border/60">
                  <td className="p-3" colSpan={8}>
                    <form action={kullaniciGuncelle} className="grid md:grid-cols-8 gap-2 items-center">
                      <input type="hidden" name="id" value={u.id} />
                      <input name="name" defaultValue={u.name} className={inputCls} />
                      <input name="phone" defaultValue={u.phone} className={inputCls} />
                      <select name="role" defaultValue={u.role} className={inputCls}>
                        {Object.entries(ROL_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <select name="departmentId" defaultValue={u.departmentId ?? ""} className={inputCls}>
                        <option value="">—</option>
                        {mudurlukler.map((m) => (
                          <option key={m.id} value={m.id}>{m.shortName || m.name}</option>
                        ))}
                      </select>
                      <label className="text-sm flex items-center gap-2">
                        <input type="checkbox" name="aktif" defaultChecked={u.aktif} /> Aktif
                      </label>
                      <span className="text-xs text-kb-muted">
                        {u.lastLoginAt
                          ? `${u.lastLoginAt.toLocaleDateString("tr-TR")} ${u.lastLoginAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`
                          : "—"}
                      </span>
                      <input name="password" type="password" placeholder="—" className={inputCls} />
                      <button className={btnSecondary}>Kaydet</button>
                    </form>
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
