import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@kars/db";
import type { Rol } from "@kars/shared";
import {
  SIKAYET_DURUM_LABELS,
  ONCELIK_LABELS,
  GOREV_DURUM_LABELS,
  YAKIT_TURU_LABELS,
  BAKIM_TURU_LABELS,
  PERSONEL_DURUM_LABELS,
  ENVANTER_DURUM_LABELS,
  OPERASYON_DURUM_LABELS,
  gercekTuketim,
  tuketimDurumu,
  sayacFarkiMaxMin,
  mevcutStok,
  stokDurumu,
  betonGuncelStok,
  betonStokDurumu,
  ayAdiFromDate,
} from "@kars/shared";
import { sheetFromRows, workbookToBuffer } from "@/lib/excel";
import {
  departmentScope,
  EXPORT_ENTITY_ROLES,
  requireSession,
  type AppSession,
} from "@/lib/authz";

const EXPORT_MAX_ROWS = 10_000;
const DEFAULT_RANGE_DAYS = 90;

function exportDateRange(req: NextRequest): { from: Date; to: Date } {
  const sp = req.nextUrl.searchParams;
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from")
    ? new Date(sp.get("from")!)
    : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error("Geçersiz from/to tarih aralığı");
  }
  return { from, to };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  let session: AppSession;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entity } = await params;
  const roles = EXPORT_ENTITY_ROLES[entity];
  if (!roles) {
    return NextResponse.json({ error: "Bilinmeyen entity" }, { status: 404 });
  }
  if (!roles.includes(session.user.role as Rol)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let range: { from: Date; to: Date };
  try {
    range = exportDateRange(req);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Geçersiz tarih" },
      { status: 400 },
    );
  }

  const dept = departmentScope(session);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kars Belediyesi";
  let filename = "export.xlsx";

  switch (entity) {
    case "sikayetler": {
      const rows = await prisma.complaint.findMany({
        where: {
          ...dept,
          kayitTarihi: { gte: range.from, lte: range.to },
        },
        orderBy: { kayitTarihi: "desc" },
        take: EXPORT_MAX_ROWS + 1,
        include: {
          neighborhood: true,
          complaintType: true,
          department: true,
          vehicle: true,
          onaylayan: true,
        },
      });
      if (rows.length > EXPORT_MAX_ROWS) {
        return NextResponse.json(
          { error: `Export limiti ${EXPORT_MAX_ROWS} satır. Tarihi daraltın.` },
          { status: 400 },
        );
      }
      sheetFromRows(
        wb,
        "Sikayetler",
        [
          "Şikayet No", "Tarih", "Arayan", "Telefon", "Mahalle", "Adres", "Tür",
          "Açıklama", "Müdürlük", "Plaka", "Öncelik", "Durum", "Kapanış", "Çözüm", "Onaylayan",
        ],
        rows.map((s) => [
          s.sikayetNo,
          s.kayitTarihi.toLocaleString("tr-TR"),
          s.arayanKisi,
          s.telefon,
          s.neighborhood?.name,
          s.acikAdres,
          s.complaintType?.name,
          s.aciklama,
          s.department?.name,
          s.vehicle?.plaka,
          ONCELIK_LABELS[s.oncelik],
          SIKAYET_DURUM_LABELS[s.durum],
          s.kapanisTarihi?.toLocaleDateString("tr-TR"),
          s.cozumNotu,
          s.onaylayan?.name,
        ]),
      );
      filename = "sikayetler.xlsx";
      break;
    }
    case "araclar": {
      const rows = await prisma.vehicle.findMany({
        where: dept,
        orderBy: { plaka: "asc" },
        take: EXPORT_MAX_ROWS + 1,
        include: { vehicleType: true, department: true, atananSofor: true },
      });
      if (rows.length > EXPORT_MAX_ROWS) {
        return NextResponse.json(
          { error: `Export limiti ${EXPORT_MAX_ROWS} satır.` },
          { status: 400 },
        );
      }
      sheetFromRows(
        wb,
        "Araclar",
        [
          "Plaka", "Ad", "Cinsi", "Marka", "Model", "Yıl", "Sayaç", "Muayene",
          "Sigorta", "Birim", "Şoför", "Envanter", "Operasyon",
        ],
        rows.map((a) => [
          a.plaka,
          a.ad,
          a.vehicleType?.name,
          a.marka,
          a.model,
          a.modelYili,
          a.sayacDeger,
          a.muayeneTarihi?.toLocaleDateString("tr-TR"),
          a.sigortaBitis?.toLocaleDateString("tr-TR"),
          a.department?.name,
          a.atananSofor?.name,
          ENVANTER_DURUM_LABELS[a.envanterDurumu],
          OPERASYON_DURUM_LABELS[a.operasyonDurumu],
        ]),
      );
      filename = "araclar.xlsx";
      break;
    }
    case "yakit": {
      const rows = await prisma.fuelRecord.findMany({
        where: {
          tarih: { gte: range.from, lte: range.to },
          ...("departmentId" in dept
            ? { vehicle: { departmentId: dept.departmentId } }
            : {}),
        },
        orderBy: { tarih: "desc" },
        take: EXPORT_MAX_ROWS + 1,
        include: { vehicle: true, sorumluPersonel: true },
      });
      if (rows.length > EXPORT_MAX_ROWS) {
        return NextResponse.json(
          { error: `Export limiti ${EXPORT_MAX_ROWS} satır. Tarihi daraltın.` },
          { status: 400 },
        );
      }
      sheetFromRows(
        wb,
        "Yakit",
        ["Tarih", "Plaka", "Tür", "Litre", "Birim Fiyat", "Tutar", "Sayaç", "Sorumlu"],
        rows.map((y) => [
          y.tarih.toLocaleDateString("tr-TR"),
          y.vehicle.plaka,
          YAKIT_TURU_LABELS[y.yakitTuru],
          Number(y.litre),
          Number(y.birimFiyat),
          Number(y.tutar),
          y.sayac,
          y.sorumluPersonel?.adSoyad,
        ]),
      );
      filename = "yakit.xlsx";
      break;
    }
    case "bakim": {
      const rows = await prisma.maintenanceRecord.findMany({
        where: {
          bakimTarihi: { gte: range.from, lte: range.to },
          ...("departmentId" in dept
            ? { vehicle: { departmentId: dept.departmentId } }
            : {}),
        },
        orderBy: { bakimTarihi: "desc" },
        take: EXPORT_MAX_ROWS + 1,
        include: { vehicle: true },
      });
      if (rows.length > EXPORT_MAX_ROWS) {
        return NextResponse.json(
          { error: `Export limiti ${EXPORT_MAX_ROWS} satır. Tarihi daraltın.` },
          { status: 400 },
        );
      }
      sheetFromRows(
        wb,
        "Bakim",
        ["Tarih", "Plaka", "Tür", "İşlemler", "Maliyet", "Firma", "Durum"],
        rows.map((b) => [
          b.bakimTarihi.toLocaleDateString("tr-TR"),
          b.vehicle.plaka,
          BAKIM_TURU_LABELS[b.bakimTuru],
          b.yapilanIslemler,
          b.maliyet != null ? Number(b.maliyet) : null,
          b.yapanFirmaPersonel,
          b.durum,
        ]),
      );
      filename = "bakim.xlsx";
      break;
    }
    case "gorevler": {
      const rows = await prisma.vehicleTask.findMany({
        where: {
          talepTarihi: { gte: range.from, lte: range.to },
          ...("departmentId" in dept
            ? {
                OR: [
                  { talepEdenDepartmentId: dept.departmentId },
                  { vehicle: { departmentId: dept.departmentId } },
                ],
              }
            : {}),
        },
        take: EXPORT_MAX_ROWS + 1,
        orderBy: { talepTarihi: "desc" },
        include: {
          vehicle: { include: { vehicleType: true } },
          driver: true,
          talepEdenDepartment: true,
        },
      });
      if (rows.length > EXPORT_MAX_ROWS) {
        return NextResponse.json(
          { error: `Export limiti ${EXPORT_MAX_ROWS} satır. Tarihi daraltın.` },
          { status: 400 },
        );
      }
      sheetFromRows(
        wb,
        "Gorevler",
        [
          "Görev No", "Tarih", "Plaka", "Cinsi", "Müdürlük", "Yer", "Tanım",
          "Şoför", "Süre", "KM Fark", "Durum", "Maliyet",
        ],
        rows.map((g) => [
          g.gorevNo,
          g.talepTarihi.toLocaleDateString("tr-TR"),
          g.vehicle.plaka,
          g.vehicle.vehicleType?.name,
          g.talepEdenDepartment?.name,
          g.gorevYeri,
          g.gorevTanimi,
          g.driver?.name,
          g.sureSaat,
          g.kmFarki,
          GOREV_DURUM_LABELS[g.durum],
          g.maliyet != null ? Number(g.maliyet) : null,
        ]),
      );
      filename = "gorevler.xlsx";
      break;
    }
    case "personel": {
      const rows = await prisma.personnel.findMany({
        where: dept,
        orderBy: { adSoyad: "asc" },
        include: { department: true },
      });
      sheetFromRows(
        wb,
        "Personel",
        ["Ad Soyad", "Unvan", "Birim", "Telefon", "İşe Giriş", "Durum", "Not"],
        rows.map((p) => [
          p.adSoyad,
          p.unvan,
          p.department?.name,
          p.telefon,
          p.iseGirisTarihi?.toLocaleDateString("tr-TR"),
          PERSONEL_DURUM_LABELS[p.durum],
          p.not,
        ]),
      );
      filename = "personel.xlsx";
      break;
    }
    case "akaryakit": {
      const araclar = await prisma.vehicle.findMany({
        where: {
          envanterDurumu: { not: "HURDAYA_AYRILDI" },
          ...dept,
        },
        include: { department: true, fuelRecords: true },
        orderBy: { plaka: "asc" },
      });
      sheetFromRows(
        wb,
        "TuketimAnalizi",
        [
          "Plaka", "Müdürlük", "Sayaç Tipi", "Toplam Litre", "Toplam Tutar",
          "Sayaç Farkı", "Gerçek Tüketim", "Norm", "Durum",
        ],
        araclar.map((a) => {
          const litre = a.fuelRecords.reduce((s, r) => s + Number(r.litre), 0);
          const tutar = a.fuelRecords.reduce((s, r) => s + Number(r.tutar), 0);
          const sayaclar = a.fuelRecords
            .map((r) => r.sayac)
            .filter((s): s is number => s != null);
          const fark = sayacFarkiMaxMin(sayaclar);
          const tip = a.sayacTipi === "SAAT" || a.sayacBirim === "SAAT" ? "SAAT" as const : "KM" as const;
          const gercek = gercekTuketim(litre, fark, tip);
          const norm = a.normTuketim ?? 0;
          const durum =
            gercek != null && norm > 0 ? tuketimDurumu(gercek, norm) : null;
          return [
            a.plaka,
            a.department?.name,
            tip,
            litre,
            tutar,
            fark,
            gercek,
            norm || null,
            durum,
          ];
        }),
      );
      filename = "akaryakit-analizi.xlsx";
      break;
    }
    case "malzeme": {
      const materials = await prisma.material.findMany({
        where: { aktif: true },
        orderBy: { kod: "asc" },
        include: { movements: true },
      });
      sheetFromRows(
        wb,
        "StokDurumu",
        ["Kod", "Ad", "Kategori", "Birim", "Giriş", "Çıkış", "Stok", "Kritik", "Durum"],
        materials.map((m) => {
          const giris = m.movements
            .filter((h) => h.tip === "GIRIS")
            .reduce((s, h) => s + Number(h.miktar), 0);
          const cikis = m.movements
            .filter((h) => h.tip === "CIKIS")
            .reduce((s, h) => s + Number(h.miktar), 0);
          const stok = mevcutStok(giris, cikis);
          return [
            m.kod,
            m.ad,
            m.kategori,
            m.birim,
            giris,
            cikis,
            stok,
            m.kritikStok,
            stokDurumu(stok, m.kritikStok),
          ];
        }),
      );
      const hareketler = await prisma.materialMovement.findMany({
        where: dept,
        orderBy: { tarih: "desc" },
        include: { material: true, department: true },
      });
      sheetFromRows(
        wb,
        "Hareketler",
        ["Tarih", "Ay", "Kod", "Tip", "Miktar", "Müdürlük", "Belge"],
        hareketler.map((h) => [
          h.tarih.toLocaleDateString("tr-TR"),
          ayAdiFromDate(h.tarih),
          h.material.kod,
          h.tip,
          Number(h.miktar),
          h.department?.name,
          h.belgeNo,
        ]),
      );
      filename = "malzeme-depo.xlsx";
      break;
    }
    case "beton": {
      const recipes = await prisma.concreteRecipe.findMany({ orderBy: { sinif: "asc" } });
      sheetFromRows(
        wb,
        "Receteler",
        [
          "Sınıf", "Çimento", "Kum", "0-5", "5-12", "12-19", "Su", "Katkı",
        ],
        recipes.map((r) => [
          r.sinif,
          r.cimentoKg,
          r.kumKg,
          r.micir05Kg,
          r.micir512Kg,
          r.micir1219Kg,
          r.suLt,
          r.katkiKg,
        ]),
      );
      const uretim = await prisma.concreteProduction.findMany({
        orderBy: { tarih: "desc" },
        include: { recipe: true },
      });
      sheetFromRows(
        wb,
        "Uretim",
        ["Tarih", "Sınıf", "m³", "Çimento", "Kum", "0-5", "5-12", "12-19", "Su", "Katkı"],
        uretim.map((u) => [
          u.tarih.toLocaleDateString("tr-TR"),
          u.recipe.sinif,
          u.hedefM3,
          u.cimentoKg,
          u.kumKg,
          u.micir05Kg,
          u.micir512Kg,
          u.micir1219Kg,
          u.suLt,
          u.katkiKg,
        ]),
      );
      const stocks = await prisma.concreteStock.findMany();
      const sum = await prisma.concreteProduction.aggregate({
        _sum: {
          cimentoKg: true,
          kumKg: true,
          micir05Kg: true,
          micir512Kg: true,
          micir1219Kg: true,
          suLt: true,
          katkiKg: true,
        },
      });
      const cikisMap: Record<string, number> = {
        Cimento: sum._sum.cimentoKg ?? 0,
        Kum: sum._sum.kumKg ?? 0,
        "Micir 0-5mm": sum._sum.micir05Kg ?? 0,
        "Micir 5-12mm": sum._sum.micir512Kg ?? 0,
        "Micir 12-19mm": sum._sum.micir1219Kg ?? 0,
        Su: sum._sum.suLt ?? 0,
        Katki: sum._sum.katkiKg ?? 0,
      };
      sheetFromRows(
        wb,
        "MalzemeStok",
        ["Malzeme", "Başlangıç", "Giriş", "Üretim Çıkış", "Güncel", "Durum"],
        stocks.map((s) => {
          const cikis = cikisMap[s.malzeme] ?? 0;
          const stok = betonGuncelStok(s.baslangicStok, s.toplamGiris, cikis);
          return [
            s.malzeme,
            s.baslangicStok,
            s.toplamGiris,
            cikis,
            stok,
            betonStokDurumu(stok, s.kritikSeviye),
          ];
        }),
      );
      filename = "beton-receteleri.xlsx";
      break;
    }
    case "bitum": {
      const hareketler = await prisma.bitumMovement.findMany({
        orderBy: { tarih: "desc" },
        include: {
          depo: true,
          kaynakDepo: true,
          hedefDepo: true,
          kullanimDepo: true,
        },
      });
      sheetFromRows(
        wb,
        "GunlukHareket",
        [
          "Tarih", "Tip", "Miktar", "Depo", "Kaynak", "Hedef", "Kullanım",
          "Alış Fiyat", "Alış Maliyet", "TIR Sefer", "Taşıma", "Ort Kaynak", "Varış ₺/ton", "Toplam",
        ],
        hareketler.map((m) => [
          m.tarih.toLocaleDateString("tr-TR"),
          m.tip,
          m.miktarTon,
          m.depo?.ad,
          m.kaynakDepo?.ad,
          m.hedefDepo?.ad,
          m.kullanimDepo?.ad,
          m.alisFiyati,
          m.alisMaliyeti,
          m.tirSeferSayisi,
          m.tasimaMaliyeti,
          m.kaynakOrtFiyat,
          m.varisMaliyetiTon,
          m.toplamMaliyet,
        ]),
      );
      filename = "bitum-hareket.xlsx";
      break;
    }
    default:
      return NextResponse.json({ error: "Bilinmeyen entity" }, { status: 404 });
  }

  const buffer = await workbookToBuffer(wb);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
