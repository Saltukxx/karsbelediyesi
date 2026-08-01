"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import {
  islerimAsfaltDurum as islerimAsfaltDurumServis,
  islerimSikayetDurum as islerimSikayetDurumServis,
} from "@/lib/services/islerim";
import { formVerisi } from "@/lib/services/base";

/** Kendisine atanan şikayetin durumunu günceller (saha personeli) */
export async function islerimSikayetDurum(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  await islerimSikayetDurumServis(session, id, formVerisi(formData));

  revalidatePath("/islerim");
  revalidatePath(`/islerim/${id}`);
  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");
}

/** Kendisine atanan asfalt rotasının durumunu günceller (saha personeli) */
export async function islerimAsfaltDurum(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  await islerimAsfaltDurumServis(session, id, formVerisi(formData));

  revalidatePath("/islerim");
  revalidatePath("/harita");
}
