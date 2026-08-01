export type Page = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

const VARSAYILAN_SAYFA_BOYU = 50;
const EN_FAZLA_SAYFA_BOYU = 200;

/**
 * `?page=1&pageSize=50` okur. Sayfalama istenmediğinde de güvenli bir üst
 * sınır uygular; mobil listeler tüm tabloyu tek seferde indirmez.
 */
export function sayfa(req: Request): Page {
  const url = new URL(req.url);
  const page = Math.max(1, tamSayi(url.searchParams.get("page")) ?? 1);
  const istenen = tamSayi(url.searchParams.get("pageSize")) ?? VARSAYILAN_SAYFA_BOYU;
  const pageSize = Math.min(EN_FAZLA_SAYFA_BOYU, Math.max(1, istenen));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function sayfali<T>(items: T[], total: number, p: Page): PagedResult<T> {
  return { items, total, page: p.page, pageSize: p.pageSize };
}

function tamSayi(v: string | null): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
