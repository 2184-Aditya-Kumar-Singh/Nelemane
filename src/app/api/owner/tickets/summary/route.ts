import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { TicketModel } from "@/server/db/models/ticket";

export async function GET() {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const attentionTickets = await TicketModel.countDocuments({ pgId, status: { $in: ["OPEN", "REOPENED"] } });
    return Response.json({ attentionTickets }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "Ticket count could not be loaded" } }, { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
