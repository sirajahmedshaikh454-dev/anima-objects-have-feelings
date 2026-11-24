import { getDb } from "@/lib/db";
import { getSoulCard } from "@/lib/db/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/objects/[id]">) {
  const card = getSoulCard(getDb(), Number((await ctx.params).id));
  return card ? Response.json(card) : Response.json({ error: "Not found" }, { status: 404 });
}
