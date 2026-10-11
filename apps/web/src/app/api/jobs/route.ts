import { forwardToBackend } from "@/lib/server/backend";

export async function POST(request: Request) {
  return forwardToBackend(request, "/v1/jobs", { method: "POST", body: await request.text() });
}
