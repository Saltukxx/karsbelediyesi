import type {
  Complaint,
  ComplaintEvent,
  ComplaintType,
  Department,
  Neighborhood,
  Vehicle,
} from "@kars/db";
import { iso } from "@/lib/api/serialize";

/** `/api/v1/complaints` liste ve detay yanıtlarının ortak ilişki kümesi. */
export const complaintInclude = {
  neighborhood: { select: { id: true, name: true } },
  complaintType: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plaka: true } },
} as const;

type ComplaintWithRels = Complaint & {
  neighborhood?: Pick<Neighborhood, "id" | "name"> | null;
  complaintType?: Pick<ComplaintType, "id" | "name"> | null;
  department?: Pick<Department, "id" | "name"> | null;
  vehicle?: Pick<Vehicle, "id" | "plaka"> | null;
};

export function serializeComplaint(c: ComplaintWithRels) {
  return {
    id: c.id,
    sikayetNo: c.sikayetNo,
    yil: c.yil,
    sira: c.sira,
    kanal: c.kanal,
    kayitTarihi: c.kayitTarihi.toISOString(),
    arayanKisi: c.arayanKisi,
    telefon: c.telefon,
    neighborhoodId: c.neighborhoodId,
    neighborhood: c.neighborhood
      ? { id: c.neighborhood.id, name: c.neighborhood.name }
      : null,
    acikAdres: c.acikAdres,
    complaintTypeId: c.complaintTypeId,
    complaintType: c.complaintType
      ? { id: c.complaintType.id, name: c.complaintType.name }
      : null,
    aciklama: c.aciklama,
    departmentId: c.departmentId,
    department: c.department ? { id: c.department.id, name: c.department.name } : null,
    oncelik: c.oncelik,
    durum: c.durum,
    kapanisTarihi: iso(c.kapanisTarihi),
    cozumNotu: c.cozumNotu,
    vehicleId: c.vehicleId,
    vehicle: c.vehicle ? { id: c.vehicle.id, plaka: c.vehicle.plaka } : null,
    soforAdi: c.soforAdi,
    soforTelefonu: c.soforTelefonu,
    lat: c.lat,
    lng: c.lng,
  };
}

type EventWithUser = Pick<ComplaintEvent, "id" | "tip" | "detay" | "createdAt"> & {
  user?: { name: string } | null;
};

/**
 * İşlem geçmişi satırı. Durum değişikliğinin eski/yeni değeri `detay` JSON'undan
 * ayrı alanlara çıkarılır; istemcilerin şemasız JSON çözümlemesi gerekmez.
 */
export function serializeComplaintEvent(e: EventWithUser) {
  const detay =
    e.detay != null && typeof e.detay === "object" && !Array.isArray(e.detay)
      ? (e.detay as Record<string, unknown>)
      : null;
  const metin = (anahtar: string): string | null =>
    typeof detay?.[anahtar] === "string" ? (detay[anahtar] as string) : null;

  return {
    id: e.id,
    tip: e.tip,
    kullanici: e.user?.name ?? null,
    eskiDurum: metin("eski"),
    yeniDurum: metin("yeni"),
    createdAt: e.createdAt.toISOString(),
  };
}
