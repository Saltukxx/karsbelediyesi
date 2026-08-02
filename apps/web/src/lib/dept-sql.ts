import { Prisma } from "@kars/db";
import type { departmentScope } from "@/lib/authz";

export type DeptScope = ReturnType<typeof departmentScope>;

/**
 * `departmentScope` sonucunu ham SQL koşuluna çevirir.
 * `column` çağrı yerinde sabit yazılır, dışarıdan veri almaz.
 */
export function deptSql(scope: DeptScope, column = '"departmentId"'): Prisma.Sql {
  if (!("departmentId" in scope)) return Prisma.empty;
  const col = Prisma.raw(column);
  const value = scope.departmentId;
  if (typeof value === "string") return Prisma.sql` AND ${col} = ${value}`;
  // { in: [] } → müdürlüğü olmayan yönetici: hiçbir kayıt görmemeli
  if (value.in.length === 0) return Prisma.sql` AND FALSE`;
  return Prisma.sql` AND ${col} IN (${Prisma.join(value.in)})`;
}
