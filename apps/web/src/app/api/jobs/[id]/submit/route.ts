import { forwardToBackend } from "@/lib/server/backend";

export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[id]/submit">) {
  const { id } = await ctx.params;
  return forwardToBackend(request, `/v1/jobs/${encodeURIComponent(id)}/submit`, {
    method: "POST",
  });
}
