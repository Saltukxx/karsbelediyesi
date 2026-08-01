import type { Prisma } from "@kars/db";
import { gun, num } from "@/lib/api/serialize";

export const PERSONEL_INCLUDE = {
  department: { select: { name: true } },
} as const;

type PersonelKaydi = Prisma.PersonnelGetPayload<{
  include: typeof PERSONEL_INCLUDE;
}>;

export function personelDto(p: PersonelKaydi) {
  return {
    id: p.id,
    adSoyad: p.adSoyad,
    unvan: p.unvan,
    departmentId: p.departmentId,
    mudurluk: p.department?.name ?? null,
    telefon: p.telefon,
    iseGirisTarihi: gun(p.iseGirisTarihi),
    durum: p.durum,
    not: p.not,
    saatUcret: num(p.saatUcret),
    userId: p.userId,
  };
}
