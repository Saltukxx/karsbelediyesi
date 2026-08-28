"use client";

import { aracHurdayaAyir } from "@/lib/actions/vehicles";

export function HurdayaAyirButton({
  aracId,
  plaka,
}: {
  aracId: string;
  plaka: string;
}) {
  return (
    <form
      action={aracHurdayaAyir}
      className="flex justify-end"
      onSubmit={(e) => {
        if (
          !confirm(
            `${plaka} plakalı aracı hurdaya ayırmak istediğinize emin misiniz? Kayıt silinmez; envanter listelerinden çıkarılır.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={aracId} />
      <button type="submit" className="text-xs text-red-600 hover:underline">
        Hurdaya ayır
      </button>
    </form>
  );
}
