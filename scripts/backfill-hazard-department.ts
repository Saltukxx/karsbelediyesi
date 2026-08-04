/**
 * RoadHazard.departmentId boş olanları oluşturanın User.departmentId'si ile doldurur.
 * Kullanım: npx tsx scripts/backfill-hazard-department.ts
 */
import { prisma } from "@kars/db";

async function main() {
  const result = await prisma.$executeRaw`
    UPDATE "RoadHazard" AS h
    SET "departmentId" = u."departmentId"
    FROM "User" AS u
    WHERE h."createdById" = u.id
      AND h."departmentId" IS NULL
      AND u."departmentId" IS NOT NULL
  `;
  console.log(`Güncellenen engel kaydı: ${result}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
