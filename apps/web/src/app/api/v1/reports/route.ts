import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

const REPORTS = [
  {
    id: "sikayetler",
    baslik: "Şikayet Raporu",
    aciklama: "Aktif ve kapalı şikayet özeti",
    tip: "export",
  },
  {
    id: "akaryakit",
    baslik: "Akaryakıt Analizi",
    aciklama: "Araç bazlı tüketim analizi",
    tip: "export",
  },
  {
    id: "gorevler",
    baslik: "Görev Raporu",
    aciklama: "Görevlendirme ve çıkış-giriş",
    tip: "export",
  },
  {
    id: "malzeme",
    baslik: "Malzeme Stok",
    aciklama: "Depo stok durumu",
    tip: "export",
  },
];

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"]);
  if (forbidden) return forbidden;

  return json(REPORTS);
}
