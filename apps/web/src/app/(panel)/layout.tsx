import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { favoritesForRole, navForRole } from "@/lib/nav";
import {
  filterNavByDepartmentModules,
  loadDepartmentModuleGroups,
} from "@/lib/dept-modules";
import { ROL_LABELS } from "@kars/shared";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/giris");

  const role = session.user.role;
  const moduleGroups = await loadDepartmentModuleGroups(
    session.user.departmentId,
  );
  const items = filterNavByDepartmentModules(navForRole(role), {
    role,
    moduleGroups,
  });
  const allowedHrefs = new Set(items.map((i) => i.href));
  // Favoriler menüde olmayan ama pathAllowedByModules ile açık yolları da tutabilir
  // (ör. CALL_CENTER → /sikayetler/yeni)
  const favorites = favoritesForRole(role).filter(
    (f) =>
      allowedHrefs.has(f.href) ||
      items.some(
        (i) =>
          i.href !== "/" &&
          (f.href === i.href || f.href.startsWith(`${i.href}/`)),
      ),
  );

  return (
    <Suspense fallback={null}>
      <AppShell
        items={items}
        favorites={favorites}
        userName={session.user.name}
        roleLabel={ROL_LABELS[role]}
        role={role}
      >
        {children}
      </AppShell>
    </Suspense>
  );
}
