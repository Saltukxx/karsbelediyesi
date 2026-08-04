import Link from "next/link";
import { prisma } from "@kars/db";
import { auth } from "@/auth";
import { departmentScope, type AppSession } from "@/lib/authz";

/** Admin / müdür için 30 gün içinde dolacak veya geçmiş araç süre uyarısı */
export async function FleetExpiryBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "DEPARTMENT_MANAGER") return null;

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const dept = departmentScope(session as AppSession);

  const adet = await prisma.vehicle.count({
    where: {
      envanterDurumu: { not: "HURDAYA_AYRILDI" },
      OR: [
        { muayeneTarihi: { lte: in30 } },
        { sigortaBitis: { lte: in30 } },
        { sonrakiBakimTarihi: { lte: in30 } },
      ],
      ...dept,
    },
  });

  if (adet <= 0) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <span className="font-semibold">{adet}</span> araçta muayene, sigorta veya
      bakım süresi 30 gün içinde doluyor ya da geçmiş.{" "}
      <Link href="/araclar?yaklasan=1" className="font-semibold underline">
        Listeyi aç
      </Link>
    </div>
  );
}
