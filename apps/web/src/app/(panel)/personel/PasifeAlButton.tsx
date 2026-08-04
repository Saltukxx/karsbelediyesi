"use client";

import { personelPasifeAl } from "@/lib/actions/personnel";

export function PasifeAlButton({
  personelId,
  adSoyad,
}: {
  personelId: string;
  adSoyad: string;
}) {
  return (
    <form
      action={personelPasifeAl}
      className="flex justify-end"
      onSubmit={(e) => {
        if (
          !confirm(
            `${adSoyad} personelini pasife almak istediğinize emin misiniz? Atama listelerinden çıkarılır; kayıt silinmez.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={personelId} />
      <button type="submit" className="text-xs text-red-600 hover:underline">
        Pasife al
      </button>
    </form>
  );
}
