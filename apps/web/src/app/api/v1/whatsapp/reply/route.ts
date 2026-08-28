import { handleV1Write, str } from "@/lib/v1-handler";
import { whatsappCevapGonderForUser } from "@/lib/domain/whatsapp-reply";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleV1Write(req, ["ADMIN", "CALL_CENTER", "DEPARTMENT_MANAGER", "DRIVER", "FIELD_WORKER"], (session, body) =>
    whatsappCevapGonderForUser(session, {
      complaintId: str(body, "complaintId"),
      text: str(body, "text"),
    }),
  );
}
