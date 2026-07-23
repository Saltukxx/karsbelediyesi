import { prisma } from "@kars/db";

export interface TaskCostInput {
  id: string;
  sureSaat: number | null;
  kmFarki: number | null;
  driverId: string | null;
  vehicleId: string;
  /** Vehicle.normTuketim (lt/100km veya lt/saat) */
  normTuketim: number | null;
  /** Manuel girilen maliyet — kırılıma "diğer" olarak eklenir */
  manuelMaliyet: number | null;
}

export interface GorevMaliyet {
  yakit: number;
  /** Bağlı yakıt kaydı yoksa norm tüketimden hesaplanan tahmin */
  yakitTahmini: boolean;
  malzeme: number;
  iscilik: number;
  diger: number;
  toplam: number;
}

/**
 * Görev başına maliyet kırılımı — N+1 önlemek için id listesiyle toplu hesaplanır.
 * yakıt = bağlı FuelRecord.tutar toplamı (yoksa kmFarki × normTuketim/100 × son birim fiyat tahmini)
 * malzeme = bağlı ÇIKIŞ hareketleri (miktar × Material.birimFiyat)
 * işçilik = sureSaat × şoförün Personnel.saatUcret
 * diğer = göreve manuel girilen maliyet
 */
export async function gorevMaliyetleri(
  tasks: TaskCostInput[],
): Promise<Map<string, GorevMaliyet>> {
  const result = new Map<string, GorevMaliyet>();
  if (tasks.length === 0) return result;

  const taskIds = tasks.map((t) => t.id);
  const driverIds = [...new Set(tasks.map((t) => t.driverId).filter((d): d is string => !!d))];

  const [yakitToplam, malzemeler, personeller, sonYakit] = await Promise.all([
    prisma.fuelRecord.groupBy({
      by: ["vehicleTaskId"],
      where: { vehicleTaskId: { in: taskIds } },
      _sum: { tutar: true },
    }),
    prisma.materialMovement.findMany({
      where: { vehicleTaskId: { in: taskIds }, tip: "CIKIS" },
      select: {
        vehicleTaskId: true,
        miktar: true,
        material: { select: { birimFiyat: true } },
      },
    }),
    driverIds.length > 0
      ? prisma.personnel.findMany({
          where: { userId: { in: driverIds } },
          select: { userId: true, saatUcret: true },
        })
      : Promise.resolve([]),
    prisma.fuelRecord.findFirst({
      orderBy: { tarih: "desc" },
      select: { birimFiyat: true },
    }),
  ]);

  const yakitByTask = new Map(
    yakitToplam
      .filter((y) => y.vehicleTaskId != null)
      .map((y) => [y.vehicleTaskId as string, Number(y._sum.tutar ?? 0)]),
  );

  const malzemeByTask = new Map<string, number>();
  for (const m of malzemeler) {
    if (!m.vehicleTaskId) continue;
    const tutar = Number(m.miktar) * Number(m.material.birimFiyat ?? 0);
    malzemeByTask.set(m.vehicleTaskId, (malzemeByTask.get(m.vehicleTaskId) ?? 0) + tutar);
  }

  const saatUcretByUser = new Map(
    personeller
      .filter((p) => p.userId != null)
      .map((p) => [p.userId as string, Number(p.saatUcret ?? 0)]),
  );

  const sonBirimFiyat = Number(sonYakit?.birimFiyat ?? 0);

  for (const t of tasks) {
    let yakit = yakitByTask.get(t.id) ?? 0;
    let yakitTahmini = false;
    if (yakit === 0 && t.kmFarki && t.normTuketim && sonBirimFiyat > 0) {
      yakit = (t.kmFarki * t.normTuketim) / 100 * sonBirimFiyat;
      yakitTahmini = true;
    }

    const malzeme = malzemeByTask.get(t.id) ?? 0;
    const saatUcret = t.driverId ? (saatUcretByUser.get(t.driverId) ?? 0) : 0;
    const iscilik = (t.sureSaat ?? 0) * saatUcret;
    const diger = t.manuelMaliyet ?? 0;

    const yuvarla = (n: number) => Math.round(n * 100) / 100;
    result.set(t.id, {
      yakit: yuvarla(yakit),
      yakitTahmini,
      malzeme: yuvarla(malzeme),
      iscilik: yuvarla(iscilik),
      diger: yuvarla(diger),
      toplam: yuvarla(yakit + malzeme + iscilik + diger),
    });
  }

  return result;
}

export function paraFormat(n: number): string {
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`;
}
