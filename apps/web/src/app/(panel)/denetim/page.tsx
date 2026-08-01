import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StickyFilter } from "@/components/ui/StickyFilter";
import { Pagination, pageSize, parsePage } from "@/components/ui/Pagination";
import { requirePageAccess } from "@/lib/authz";
import { denetimListesi } from "@/lib/services/audit-log";

export const dynamic = "force-dynamic";

const ISLEM_LABELS: Record<string, string> = {
  GIRIS: "Giriş",
  GIRIS_BASARISIZ: "Başarısız giriş",
  SIKAYET_OLUSTUR: "Şikayet oluşturuldu",
  SIKAYET_DURUM_GUNCELLE: "Şikayet durumu değişti",
  SIKAYET_ATA: "Şikayet ataması",
  GOREV_OLUSTUR: "Görev oluşturuldu",
  GOREV_BASLAT: "Görev başlatıldı",
  GOREV_KAPAT: "Görev kapatıldı",
  KONTROL_FORMU_ONAYA_GONDER: "Kontrol formu onaya gönderildi",
  KONTROL_FORMU_KARAR: "Kontrol formu kararı",
  WHATSAPP_ONAYLA: "WhatsApp onaylandı",
  WHATSAPP_REDDET: "WhatsApp reddedildi",
  KULLANICI_OLUSTUR: "Kullanıcı oluşturuldu",
  KULLANICI_GUNCELLE: "Kullanıcı güncellendi",
  ARAC_OLUSTUR: "Araç oluşturuldu",
  ARAC_GUNCELLE: "Araç güncellendi",
  BAKIM_OLUSTUR: "Bakım kaydı",
  YAKIT_OLUSTUR: "Yakıt kaydı",
  MALZEME_OLUSTUR: "Malzeme oluşturuldu",
  STOK_HAREKET_OLUSTUR: "Stok hareketi",
  PERSONEL_OLUSTUR: "Personel oluşturuldu",
  PERSONEL_GUNCELLE: "Personel güncellendi",
  PERSONEL_GUNLUK_OLUSTUR: "Personel günlük kaydı",
  ARAC_GUNLUK_OLUSTUR: "Araç günlük kaydı",
  BETON_URETIM_OLUSTUR: "Beton üretimi",
  BETON_STOK_GIRIS: "Beton stok girişi",
  BETON_RECETE_GUNCELLE: "Beton reçetesi güncellendi",
  BITUM_AYAR_KAYDET: "Bitüm ayarları",
  BITUM_HAREKET_OLUSTUR: "Bitüm hareketi",
  AGREGA_PARAMETRE_KAYDET: "Agrega parametreleri",
  ASFALT_YOL_SIL: "Asfalt yolu silindi",
  ENGEL_KAYDET: "Engel işaretlendi",
  ENGEL_SIL: "Engel silindi",
};

export default async function DenetimPage({
  searchParams,
}: {
  searchParams: Promise<{
    kullanici?: string;
    islem?: string;
    varlik?: string;
    baslangic?: string;
    bitis?: string;
    page?: string;
    size?: string;
  }>;
}) {
  const session = await requirePageAccess("/denetim");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const take = pageSize(sp.size, 50);

  // Filtre/sayfalama mantığı servis katmanında; `/api/v1/denetim` ile ortak
  const {
    kayitlar,
    toplamSayfa: totalPages,
    islemler,
    varliklar,
  } = await denetimListesi(session, { ...sp, page, size: take });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Denetim İzi"
        description="Panel ve API üzerinden yapılan tüm önemli işlemlerin kaydı."
      />

      <StickyFilter>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <input
            name="kullanici"
            defaultValue={sp.kullanici ?? ""}
            placeholder="Kullanıcı adı..."
            className="w-48 rounded-md border border-kb-border px-3 py-1.5 text-sm"
          />
          <select
            name="islem"
            defaultValue={sp.islem ?? ""}
            className="rounded-md border border-kb-border px-3 py-1.5 text-sm"
          >
            <option value="">Tüm İşlemler</option>
            {islemler.map((i) => (
              <option key={i} value={i}>
                {ISLEM_LABELS[i] ?? i}
              </option>
            ))}
          </select>
          <select
            name="varlik"
            defaultValue={sp.varlik ?? ""}
            className="rounded-md border border-kb-border px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Varlıklar</option>
            {varliklar.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm text-kb-muted">
            Başlangıç
            <input
              type="date"
              name="baslangic"
              defaultValue={sp.baslangic ?? ""}
              className="rounded-md border border-kb-border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-1 text-sm text-kb-muted">
            Bitiş
            <input
              type="date"
              name="bitis"
              defaultValue={sp.bitis ?? ""}
              className="rounded-md border border-kb-border px-2 py-1.5 text-sm"
            />
          </label>
          <button className="rounded-md bg-kb-navy px-4 py-1.5 text-sm text-white">
            Filtrele
          </button>
        </form>
      </StickyFilter>

      <DataTable
        minWidth="900px"
        empty={kayitlar.length === 0}
        emptyTitle="Denetim kaydı yok"
        emptyDescription="Filtreleri değiştirin veya işlemler yapıldıkça kayıtlar burada görünecek."
      >
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Kullanıcı</th>
            <th>Rol</th>
            <th>İşlem</th>
            <th>Varlık</th>
            <th>Detay</th>
          </tr>
        </thead>
        <tbody>
          {kayitlar.map((k) => (
            <tr key={k.id}>
              <td className="whitespace-nowrap">
                {k.zaman.toLocaleDateString("tr-TR")}{" "}
                <span className="text-kb-muted">
                  {k.zaman.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </td>
              <td>{k.userAd}</td>
              <td>
                <StatusBadge label={k.rol} />
              </td>
              <td>{ISLEM_LABELS[k.islem] ?? k.islem}</td>
              <td className="whitespace-nowrap">
                {k.varlik ?? "—"}
                {k.varlikId ? (
                  <span className="ml-1 font-mono text-xs text-kb-muted">
                    {k.varlikId.slice(-6)}
                  </span>
                ) : null}
              </td>
              <td className="max-w-xs truncate font-mono text-xs text-kb-muted">
                {k.detay ? JSON.stringify(k.detay) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/denetim"
        searchParams={{
          kullanici: sp.kullanici,
          islem: sp.islem,
          varlik: sp.varlik,
          baslangic: sp.baslangic,
          bitis: sp.bitis,
          size: sp.size,
        }}
      />
    </div>
  );
}
