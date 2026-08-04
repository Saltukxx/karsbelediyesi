import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { favoritesForRole, navForRole } from "@/lib/nav";
import {
  filterNavByDepartmentModules,
  loadDepartmentModuleHrefs,
} from "@/lib/dept-modules";
import { ROL_LABELS } from "@kars/shared";
import { FleetExpiryBanner } from "@/components/FleetExpiryBanner";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/giris");

  const role = session.user.role;
  const moduleHrefs = await loadDepartmentModuleHrefs(
    session.user.departmentId,
  );
  const items = filterNavByDepartmentModules(navForRole(role), {
    role,
    moduleHrefs,
  });
  const allowedHrefs = new Set(items.map((i) => i.href));
  const favorites = favoritesForRole(role).filter(
    (f) =>
      allowedHrefs.has(f.href) ||
      items.some(
        (i) =>
          i.href !== "/" &&
          (f.href === i.href || f.href.startsWith(`${i.href}/`)),
      ),
  );

  const showFleetBanner =
    role === "ADMIN" || role === "DEPARTMENT_MANAGER";

  return (
    <Suspense fallback={null}>
      <AppShell
        items={items}
        favorites={favorites}
        userName={session.user.name}
        roleLabel={ROL_LABELS[role]}
        role={role}
      >
        {showFleetBanner ? <FleetExpiryBanner /> : null}
        {children}
      </AppShell>
    </Suspense>
  );
}
