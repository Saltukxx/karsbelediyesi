import { withApiUser, json } from "@/lib/api-v1";
import { apiUserToSession, moduleHrefsForUser } from "@/lib/api-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const session = apiUserToSession(auth.user);
  const moduleHrefs = await moduleHrefsForUser(session.user);
  return json({
    user: {
      id: auth.user.id,
      name: auth.user.name,
      phone: auth.user.phone,
      role: auth.user.role,
      departmentId: auth.user.departmentId,
    },
    moduleHrefs,
  });
}
