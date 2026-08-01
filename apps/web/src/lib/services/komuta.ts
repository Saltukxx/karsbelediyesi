import { ACTION_ROLES } from "@/lib/authz";
import { komutaFiltresi, komutaVerisiGetir, type KomutaVeri } from "@/lib/komuta";
import { rolGerekli, type ServiceActor } from "@/lib/services/base";

/**
 * Komuta ekranı verisi. Toplama mantığı `lib/komuta.ts` içinde; servis katmanı
 * yalnız yetki ve kapsam filtresini uygular, böylece web sayfası ile mobil
 * aynı veriyi görür.
 */
export async function komutaVerisi(actor: ServiceActor): Promise<KomutaVeri> {
  rolGerekli(actor, ACTION_ROLES.komuta);
  return komutaVerisiGetir(komutaFiltresi(actor.user));
}
