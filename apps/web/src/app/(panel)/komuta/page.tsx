import { requirePageAccess } from "@/lib/authz";
import { komutaVerisiGetir, komutaFiltresi } from "@/lib/komuta";
import KomutaClient from "@/components/komuta/KomutaClient";

export const dynamic = "force-dynamic";

export default async function KomutaPage() {
  const session = await requirePageAccess("/komuta");
  const ilkVeri = await komutaVerisiGetir(komutaFiltresi(session.user));
  return <KomutaClient ilkVeri={ilkVeri} />;
}
