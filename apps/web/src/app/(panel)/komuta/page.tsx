import { requirePageAccess } from "@/lib/authz";
import { komutaVerisiGetir } from "@/lib/komuta";
import KomutaClient from "@/components/komuta/KomutaClient";

export const dynamic = "force-dynamic";

export default async function KomutaPage() {
  await requirePageAccess("/komuta");
  const ilkVeri = await komutaVerisiGetir();
  return <KomutaClient ilkVeri={ilkVeri} />;
}
