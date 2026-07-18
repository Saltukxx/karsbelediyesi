import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  /** Mevcut path + diğer query’ler (page hariç) */
  basePath: string;
  searchParams?: Record<string, string | undefined>;
};

export function parsePage(raw: string | undefined, fallback = 1): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export function pageSize(raw: string | undefined, fallback = 25): number {
  const n = Number(raw);
  if (n === 50 || n === 25) return n;
  return fallback;
}

export function Pagination({ page, totalPages, basePath, searchParams = {} }: Props) {
  if (totalPages <= 1) return null;

  function href(p: number) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && v !== "" && k !== "page") q.set(k, v);
    }
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm"
      aria-label="Sayfalama"
    >
      <p className="text-kb-muted">
        Sayfa <span className="font-semibold text-kb-navy">{page}</span> / {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className="rounded-lg border border-kb-border bg-white px-3 py-2 font-medium text-kb-navy hover:bg-kb-bg"
          >
            Önceki
          </Link>
        ) : (
          <span className="rounded-lg border border-transparent px-3 py-2 text-kb-muted">Önceki</span>
        )}
        {page < totalPages ? (
          <Link
            href={href(page + 1)}
            className="rounded-lg border border-kb-border bg-white px-3 py-2 font-medium text-kb-navy hover:bg-kb-bg"
          >
            Sonraki
          </Link>
        ) : (
          <span className="rounded-lg border border-transparent px-3 py-2 text-kb-muted">Sonraki</span>
        )}
      </div>
    </nav>
  );
}
