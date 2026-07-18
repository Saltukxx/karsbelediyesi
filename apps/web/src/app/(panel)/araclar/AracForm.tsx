import type { Department, User, Vehicle, VehicleType } from "@kars/db";
import {
  ENVANTER_DURUM_LABELS,
  OPERASYON_DURUM_LABELS,
  YAKIT_TIPI_LABELS,
} from "@kars/shared";
import Link from "next/link";

const inputCls =
  "w-full rounded-md border border-kb-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kb-navy/30";
const labelCls = "block text-sm font-medium mb-1 text-kb-ink";

function d(t: Date | null | undefined): string {
  return t ? t.toISOString().slice(0, 10) : "";
}

export function AracForm({
  action,
  arac,
  cinsler,
  mudurlukler,
  soforler,
}: {
  action: (formData: FormData) => Promise<void>;
  arac?: Vehicle | null;
  cinsler: VehicleType[];
  mudurlukler: Department[];
  soforler: User[];
}) {
  return (
    <form action={action} className="rounded-lg border border-kb-border bg-white shadow-sm p-6 space-y-5">
      {arac && <input type="hidden" name="id" value={arac.id} />}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Plaka / Seri No *</label>
          <input name="plaka" required defaultValue={arac?.plaka ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Araç / Makine Adı</label>
          <input name="ad" defaultValue={arac?.ad ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cinsi</label>
          <select name="vehicleTypeId" defaultValue={arac?.vehicleTypeId ?? ""} className={inputCls}>
            <option value="">— Seçiniz —</option>
            {cinsler.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Marka</label>
          <input name="marka" defaultValue={arac?.marka ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Model</label>
          <input name="model" defaultValue={arac?.model ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Model Yılı</label>
          <input name="modelYili" type="number" defaultValue={arac?.modelYili ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Yakıt Tipi</label>
          <select name="yakitTipi" defaultValue={arac?.yakitTipi ?? ""} className={inputCls}>
            <option value="">— Seçiniz —</option>
            {Object.entries(YAKIT_TIPI_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Kapasite</label>
          <input name="kapasite" defaultValue={arac?.kapasite ?? ""} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Sayaç</label>
            <input name="sayacDeger" type="number" step="0.1" defaultValue={arac?.sayacDeger ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Birim</label>
            <select
              name="sayacBirim"
              defaultValue={arac?.sayacTipi ?? arac?.sayacBirim ?? "KM"}
              className={inputCls}
            >
              <option value="KM">KM</option>
              <option value="SAAT">Saat</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Norm Tüketim (lt/100km veya lt/saat)</label>
          <input
            name="normTuketim"
            type="number"
            step="0.01"
            defaultValue={arac?.normTuketim ?? ""}
            className={inputCls}
            placeholder="Örn. 12.5"
          />
        </div>
        <div>
          <label className={labelCls}>Muayene Tarihi</label>
          <input name="muayeneTarihi" type="date" defaultValue={d(arac?.muayeneTarihi)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Sigorta Bitiş</label>
          <input name="sigortaBitis" type="date" defaultValue={d(arac?.sigortaBitis)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Son Bakım Tarihi</label>
          <input name="sonBakimTarihi" type="date" defaultValue={d(arac?.sonBakimTarihi)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Sonraki Bakım Tarihi</label>
          <input name="sonrakiBakimTarihi" type="date" defaultValue={d(arac?.sonrakiBakimTarihi)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Bakım KM / Saati</label>
          <input name="bakimKmSaati" defaultValue={arac?.bakimKmSaati ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Bağlı Müdürlük</label>
          <select name="departmentId" defaultValue={arac?.departmentId ?? ""} className={inputCls}>
            <option value="">— Seçiniz —</option>
            {mudurlukler.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Atanan Şoför (Zimmet)</label>
          <select name="atananSoforId" defaultValue={arac?.atananSoforId ?? ""} className={inputCls}>
            <option value="">— Yok —</option>
            {soforler.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Envanter Durumu</label>
          <select name="envanterDurumu" defaultValue={arac?.envanterDurumu ?? "AKTIF"} className={inputCls}>
            {Object.entries(ENVANTER_DURUM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Operasyon Durumu</label>
          <select name="operasyonDurumu" defaultValue={arac?.operasyonDurumu ?? "MUSAIT"} className={inputCls}>
            {Object.entries(OPERASYON_DURUM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Notlar</label>
        <textarea name="notlar" rows={2} defaultValue={arac?.notlar ?? ""} className={inputCls} />
      </div>
      <div className="flex justify-end gap-2">
        <Link href="/araclar" className="rounded-md border border-kb-border px-4 py-2 text-sm text-kb-muted">
          Vazgeç
        </Link>
        <button className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-6 py-2 text-sm font-medium">
          Kaydet
        </button>
      </div>
    </form>
  );
}
