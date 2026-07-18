import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const fen = await prisma.department.findUnique({ where: { name: "Fen İşleri Müdürlüğü" } });
  const su = await prisma.department.findUnique({ where: { name: "Su ve Kanalizasyon İşleri Müdürlüğü" } });
  const jcbTip = await prisma.vehicleType.findUnique({ where: { name: "JCB" } });
  const kamyonTip = await prisma.vehicleType.findUnique({ where: { name: "Kamyon" } });

  // Şoför kullanıcı
  const soforPass = await bcrypt.hash("sofor123", 10);
  const sofor = await prisma.user.upsert({
    where: { phone: "05001112233" },
    update: {},
    create: { name: "Mehmet Kaya", phone: "05001112233", passwordHash: soforPass, role: "DRIVER", departmentId: fen?.id },
  });

  // Araçlar
  await prisma.vehicle.upsert({
    where: { plaka: "36 AB 123" },
    update: {},
    create: {
      plaka: "36 AB 123", ad: "JCB Beko Loder", vehicleTypeId: jcbTip?.id, marka: "JCB", model: "3CX",
      modelYili: 2019, yakitTipi: "DIZEL", departmentId: fen?.id, atananSoforId: sofor.id,
      muayeneTarihi: new Date("2026-09-15"), sigortaBitis: new Date("2026-11-01"),
    },
  });
  await prisma.vehicle.upsert({
    where: { plaka: "36 KL 456" },
    update: {},
    create: {
      plaka: "36 KL 456", ad: "Vidanjör", vehicleTypeId: kamyonTip?.id, marka: "Mercedes", model: "Atego",
      modelYili: 2021, yakitTipi: "DIZEL", departmentId: su?.id,
    },
  });

  // Personel
  for (const [ad, unvan, depId] of [
    ["Ali Demir", "İşçi", fen?.id],
    ["Veli Şahin", "Operatör", fen?.id],
    ["Ayşe Yılmaz", "Tekniker", su?.id],
  ] as const) {
    const mevcut = await prisma.personnel.findFirst({ where: { adSoyad: ad } });
    if (!mevcut) {
      await prisma.personnel.create({ data: { adSoyad: ad, unvan, departmentId: depId ?? undefined } });
    }
  }
  console.log("test verisi hazır");
}
main().finally(() => prisma.$disconnect());
