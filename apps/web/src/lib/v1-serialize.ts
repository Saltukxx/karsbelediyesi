import type { Complaint, Department, Neighborhood, ComplaintType, Vehicle } from "@kars/db";

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
    kapanisTarihi: c.kapanisTarihi?.toISOString() ?? null,
    cozumNotu: c.cozumNotu,
    vehicleId: c.vehicleId,
    vehicle: c.vehicle ? { id: c.vehicle.id, plaka: c.vehicle.plaka } : null,
    lat: c.lat,
    lng: c.lng,
  };
}
