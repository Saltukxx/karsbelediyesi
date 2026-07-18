export type MobileSession = {
  token: string;
  user: {
    id: string;
    name: string;
    phone: string;
    role: string;
    departmentId: string | null;
  };
};

export type ComplaintSummary = {
  id: string;
  sikayetNo: string;
  arayanKisi: string;
  acikAdres: string | null;
  aciklama: string | null;
  oncelik: string;
  durum: string;
  neighborhood?: { name: string } | null;
  complaintType?: { name: string } | null;
};

export type VehicleTaskSummary = {
  id: string;
  gorevNo: string;
  gorevYeri: string | null;
  gorevTanimi: string | null;
  durum: string;
  vehicle: { id: string; plaka: string; sayacDeger: number | null };
};

export class KarsApiClient {
  constructor(
    private baseUrl: string,
    private token?: string,
  ) {}

  setToken(token: string | undefined) {
    this.token = token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  login(phone: string, password: string) {
    return this.request<MobileSession>("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
  }

  myComplaints() {
    return this.request<ComplaintSummary[]>("/api/mobile/complaints");
  }

  updateComplaint(
    id: string,
    data: { durum: string; cozumNotu?: string; lat?: number; lng?: number },
  ) {
    return this.request(`/api/mobile/complaints/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  myTasks() {
    return this.request<VehicleTaskSummary[]>("/api/mobile/tasks");
  }

  startTask(id: string, kmSayacCikis?: number) {
    return this.request(`/api/mobile/tasks/${id}/start`, {
      method: "POST",
      body: JSON.stringify({ kmSayacCikis }),
    });
  }

  closeTask(id: string, data: { kmSayacGiris?: number; durum?: string }) {
    return this.request(`/api/mobile/tasks/${id}/close`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  createWorkLog(data: {
    girisSaati: string;
    cikisSaati: string;
    yapilanIs?: string;
  }) {
    return this.request("/api/mobile/worklog", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  createFuel(data: {
    vehicleId: string;
    litre: number;
    birimFiyat: number;
    sayac?: number;
    yakitTuru?: string;
  }) {
    return this.request("/api/mobile/fuel", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  checklistTemplates() {
    return this.request("/api/mobile/checklists/templates");
  }

  syncChecklist(payload: unknown) {
    return this.request("/api/mobile/checklists/sync", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}
