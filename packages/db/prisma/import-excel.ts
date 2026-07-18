/**
 * Dolu Excel çalışma kitaplarından temel listeleri içe aktarır.
 *
 * Kullanım (repo kökünden):
 *   npm run db:import -- ./import/personel.xlsx
 *
 * Desteklenen sayfa adları (ilk satır başlık):
 *   - Personel / Personel Listesi → Personnel
 *   - Araç / Araç Listesi / Araç Envanteri → Vehicle (plaka zorunlu)
 */
import { readFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { prisma } from "../src/index";

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const hit = Object.keys(row).find(
      (h) => h.trim().toLowerCase() === k.toLowerCase(),
    );
    if (hit != null && row[hit] != null && String(row[hit]).trim() !== "") {
      return String(row[hit]).trim();
    }
  }
  return undefined;
}

async function importPersonel(rows: Record<string, unknown>[]) {
  let n = 0;
  for (const row of rows) {
    const adSoyad = cell(row, "Ad Soyad", "ADI SOYADI", "Adı Soyadı");
    if (!adSoyad) continue;
    const telefon = cell(row, "Tel No", "Telefon", "TELEFON");
    const unvan = cell(row, "Unvan/Görevi", "Görev/Unvan", "Unvan");
    const birim = cell(row, "Bağlı Birim", "Müdürlük/Birim", "Birim");
    let departmentId: string | undefined;
    if (birim) {
      const d = await prisma.department.findFirst({
        where: {
          OR: [
            { name: { equals: birim, mode: "insensitive" } },
            { shortName: { equals: birim, mode: "insensitive" } },
          ],
        },
      });
      departmentId = d?.id;
    }

    const existing = await prisma.personnel.findFirst({
      where: {
        adSoyad,
        ...(telefon ? { telefon } : {}),
      },
    });
    if (existing) {
      await prisma.personnel.update({
        where: { id: existing.id },
        data: { telefon, unvan, departmentId },
      });
    } else {
      await prisma.personnel.create({
        data: { adSoyad, telefon, unvan, departmentId },
      });
    }
    n += 1;
  }
  return n;
}

async function importArac(rows: Record<string, unknown>[]) {
  let n = 0;
  for (const row of rows) {
    const plaka = cell(row, "Plaka/Seri No", "Plaka", "Araç No", "PLAKA");
    if (!plaka) continue;
    const ad = cell(row, "Araç/Makine Adı", "Ad", "Araç Adı");
    const marka = cell(row, "Marka", "Marka/Model");
    const model = cell(row, "Model");
    await prisma.vehicle.upsert({
      where: { plaka },
      create: { plaka, ad, marka, model },
      update: { ad, marka, model },
    });
    n += 1;
  }
  return n;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Kullanım: npm run db:import -- <dosya.xlsx>");
    process.exit(1);
  }
  const abs = path.resolve(file);
  const wb = XLSX.read(readFileSync(abs), { type: "buffer" });
  let personel = 0;
  let arac = 0;

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]);
    const lower = name.toLowerCase();
    if (lower.includes("personel")) {
      const c = await importPersonel(rows);
      personel += c;
      console.log(`✓ ${name}: ${c} personel`);
    } else if (lower.includes("araç") || lower.includes("arac") || lower.includes("envanter")) {
      const c = await importArac(rows);
      arac += c;
      console.log(`✓ ${name}: ${c} araç`);
    } else {
      console.log(`· Atlandı: ${name} (${rows.length} satır)`);
    }
  }

  console.log(`Bitti. Personel=${personel}, Araç=${arac}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
