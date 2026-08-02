export type SortDir = "asc" | "desc";

export type SortState<K extends string = string> = {
  key: K;
  dir: SortDir;
};

/** URL'de tek parametre olarak taşınır: `?sirala=kayitTarihi:desc` */
export const SORT_PARAM = "sirala";

/**
 * `sirala` parametresini çözer. Beyaz listede olmayan kolon adı yok sayılıp
 * varsayılana düşülür — kolon adı doğrudan Prisma `orderBy`'a gitmez.
 */
export function parseSort<K extends string>(
  raw: string | undefined,
  allowed: readonly K[],
  fallback: SortState<K>,
): SortState<K> {
  if (!raw) return fallback;
  const [key, dir] = raw.split(":");
  if (!allowed.includes(key as K)) return fallback;
  return { key: key as K, dir: dir === "asc" ? "asc" : "desc" };
}

export function sortValue(state: SortState): string {
  return `${state.key}:${state.dir}`;
}

/**
 * Kolon anahtarını Prisma `orderBy` nesnesine çevirir. Sayfa kendi haritasını
 * verir; böylece ilişkili alanlar (`{ department: { name: … } }`) da desteklenir.
 */
export function orderByFor<
  K extends string,
  M extends Record<K, (dir: SortDir) => unknown>,
>(state: SortState<K>, map: M): ReturnType<M[K]> {
  return map[state.key](state.dir) as ReturnType<M[K]>;
}
