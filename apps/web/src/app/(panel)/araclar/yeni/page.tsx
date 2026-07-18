import Link from "next/link";
import { prisma } from "@kars/db";
import { aracOlustur } from "@/lib/actions/vehicles";
import { AracForm } from "../AracForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function YeniAracPage() {
  await requirePageAccess("/araclar");
  const [cinsler, mudurlukler, soforler] = await Promise.all([
    prisma.vehicleType.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "DRIVER", aktif: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Yeni Araç"
        description="Filo envanterine yeni araç veya iş makinesi ekleyin."
        actions={
          <Link href="/araclar" className="text-sm text-kb-muted hover:text-kb-ink">
            ← Liste
          </Link>
        }
      />
      <AracForm action={aracOlustur} cinsler={cinsler} mudurlukler={mudurlukler} soforler={soforler} />
    </div>
  );
}
