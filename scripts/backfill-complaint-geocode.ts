/**
 * Konumu boş, mahalle veya açık adresi dolu şikayetleri Nominatim ile doldurur.
 * Rate limit: ~1 istek/sn (geocodeKarsAdres içinde).
 *
 * Çalıştırma (repo kökünden):
 *   npx tsx scripts/backfill-complaint-geocode.ts
 *   npx tsx scripts/backfill-complaint-geocode.ts --dry-run
 *   npx tsx scripts/backfill-complaint-geocode.ts --limit=50
 */
import { prisma } from "../packages/db/src/index";
import { geocodeKarsAdres } from "../packages/shared/src/geocode";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = Math.max(1, Number(arg("limit") ?? "500") || 500);

  const kayitlar = await prisma.complaint.findMany({
    where: {
      lat: null,
      OR: [
        { acikAdres: { not: null } },
        { neighborhoodId: { not: null } },
      ],
    },
    select: {
      id: true,
      sikayetNo: true,
      acikAdres: true,
      neighborhood: { select: { name: true } },
    },
    orderBy: { kayitTarihi: "desc" },
    take: limit,
  });

  console.log(
    `${kayitlar.length} kayıt aday${dryRun ? " (dry-run)" : ""} — limit ${limit}`,
  );

  let dolu = 0;
  let bos = 0;

  for (const k of kayitlar) {
    const geo = await geocodeKarsAdres({
      mahalle: k.neighborhood?.name,
      adres: k.acikAdres,
    });
    if (!geo) {
      bos += 1;
      console.log(`  · ${k.sikayetNo}: bulunamadı`);
      continue;
    }
    dolu += 1;
    console.log(
      `  ✓ ${k.sikayetNo}: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} — ${geo.displayName.slice(0, 60)}`,
    );
    if (dryRun) continue;

    await prisma.complaint.update({
      where: { id: k.id },
      data: {
        lat: geo.lat,
        lng: geo.lng,
        events: {
          create: {
            tip: "KONUM_GUNCELLENDI",
            detay: {
              kaynak: "geocode-backfill",
              displayName: geo.displayName,
              lat: geo.lat,
              lng: geo.lng,
            },
          },
        },
      },
    });
  }

  console.log(`Bitti: ${dolu} dolduruldu, ${bos} boş kaldı`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
