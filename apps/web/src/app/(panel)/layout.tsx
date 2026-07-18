import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { favoritesForRole, navForRole } from "@/lib/nav";
import { ROL_LABELS } from "@kars/shared";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/giris");

  const role = session.user.role;
  const items = navForRole(role);
  const favorites = favoritesForRole(role);

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
