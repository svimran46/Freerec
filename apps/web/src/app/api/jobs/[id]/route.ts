import { forwardToBackend } from "@/lib/server/backend";

export async function GET(request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  return forwardToBackend(request, `/v1/jobs/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  return forwardToBackend(request, `/v1/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
}
