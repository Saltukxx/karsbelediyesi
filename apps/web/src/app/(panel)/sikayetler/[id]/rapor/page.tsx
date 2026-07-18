import { notFound } from "next/navigation";
import { prisma } from "@kars/db";
import {
  ONCELIK_LABELS,
  SIKAYET_DURUM_LABELS,
} from "@kars/shared";
import { YazdirButonu } from "./yazdir";
import { BrandMark } from "@/components/BrandMark";
import { canAccessComplaint, toAccessUser } from "@/lib/access";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * Excel "RAPORLAMA" sayfasının birebir karşılığı:
 * Şikayet Bilgileri / Konum / Açıklama / Görevlendirme / Onay & İmza blokları.
 * Tarayıcı yazdırma ile PDF alınır.
 */
export default async function IsEmriRaporuPage({
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
    },
  });
  if (!s || !canAccessComplaint(toAccessUser(session.user), s)) notFound();

  function Satir({ ad, deger }: { ad: string; deger?: string | null }) {
    return (
      <div className="flex text-sm py-1">
        <div className="w-40 font-medium text-kb-muted">{ad}:</div>
        <div className="flex-1">{deger || "—"}</div>
      </div>
    );
  }

  function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
    return (
      <section className="mb-4">
        <div className="bg-kb-navy-deep text-white text-sm font-semibold px-3 py-1.5 print:bg-kb-navy-deep">
          {baslik}
        </div>
        <div className="border border-kb-border p-3 grid grid-cols-2 gap-x-8">{children}</div>
      </section>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white text-kb-ink p-8 print:p-0 rounded-xl shadow print:shadow-none">
      <div className="flex justify-end mb-4 print:hidden">
        <YazdirButonu />
      </div>

      {/* Başlık */}
      <header className="border-b-2 border-kb-navy pb-4 mb-6">
        <div className="flex justify-center">
          <BrandMark size="lg" />
        </div>
        <p className="mt-4 text-center text-sm font-semibold uppercase tracking-wider text-kb-muted">
          Şikayet / İş Emri Raporu
        </p>
        <p className="mt-2 text-center font-mono text-lg font-bold text-kb-navy">{s.sikayetNo}</p>
      </header>

      <Bolum baslik="ŞİKAYET BİLGİLERİ">
        <div>
          <Satir ad="Şikayet No" deger={s.sikayetNo} />
          <Satir ad="Kayıt Tarihi" deger={s.kayitTarihi.toLocaleDateString("tr-TR")} />
          <Satir
            ad="Kayıt Saati"
            deger={s.kayitTarihi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          />
          <Satir ad="Arayan Kişi" deger={s.arayanKisi} />
          <Satir ad="Telefon" deger={s.telefon} />
        </div>
        <div>
          <Satir ad="Müdürlük" deger={s.department?.name} />
          <Satir ad="Şikayet Türü" deger={s.complaintType?.name} />
          <Satir ad="Öncelik" deger={ONCELIK_LABELS[s.oncelik]} />
          <Satir ad="Durum" deger={SIKAYET_DURUM_LABELS[s.durum]} />
          <Satir ad="Kapanış Tarihi" deger={s.kapanisTarihi?.toLocaleDateString("tr-TR")} />
        </div>
      </Bolum>

      <Bolum baslik="KONUM BİLGİLERİ">
        <Satir ad="Mahalle" deger={s.neighborhood?.name} />
        <Satir ad="Açık Adres" deger={s.acikAdres} />
      </Bolum>

      <section className="mb-4">
        <div className="bg-kb-navy-deep text-white text-sm font-semibold px-3 py-1.5">
          ŞİKAYET AÇIKLAMASI
        </div>
        <div className="border border-kb-border p-3 text-sm min-h-16">{s.aciklama || "—"}</div>
      </section>

      <Bolum baslik="GÖREVLENDİRME BİLGİLERİ">
        <div>
          <Satir ad="Araç Plakası" deger={s.vehicle?.plaka} />
          <Satir ad="Şoför Adı" deger={s.soforAdi ?? s.vehicle?.atananSofor?.name} />
          <Satir ad="Şoför Telefonu" deger={s.soforTelefonu ?? s.vehicle?.atananSofor?.phone} />
        </div>
        <div>
          <Satir
            ad="Görevlendirilen Personel"
            deger={s.personel.map((p) => p.personnel.adSoyad).join(", ")}
          />
          <Satir ad="Müdürlük" deger={s.department?.name} />
          <Satir ad="Çözüm Notu" deger={s.cozumNotu} />
        </div>
      </Bolum>

      {/* ONAY ve İMZA — Excel R23-R24 */}
      <section className="mb-6">
        <div className="bg-kb-navy-deep text-white text-sm font-semibold px-3 py-1.5">
          ONAY ve İMZA
        </div>
        <div className="border border-kb-border p-6 grid grid-cols-3 gap-8 text-center text-sm">
          {["Hazırlayan", "Kontrol Eden", "Onaylayan"].map((rol) => (
            <div key={rol}>
              <div className="font-medium mb-12">{rol}</div>
              <div className="border-t border-slate-400 pt-1 text-kb-muted">
                {rol === "Onaylayan" ? s.onaylayan?.name ?? "" : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-xs text-kb-muted border-t pt-3">
        Kars Belediyesi | Rapor Tarihi: {new Date().toLocaleDateString("tr-TR")} | Bu belge
        Saha Operasyon Yönetim Sistemi tarafından üretilmiştir.
      </footer>
    </div>
  );
}
