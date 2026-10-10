import "server-only";

/**
 * Forwards a job request to the FastAPI backend. The browser never talks to the
 * backend directly, which keeps a single place for future rate limiting and bot checks.
 */
export async function forwardToBackend(
  request: Request,
  path: string,
  init: { method: string; body?: string } = { method: request.method },
): Promise<Response> {
  const base = process.env.BACKEND_URL ?? "http://localhost:8000";
  const headers = new Headers({ "content-type": "application/json" });
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  try {
    const res = await fetch(new URL(path, base), {
      method: init.method,
      headers,
      body: init.body,
      cache: "no-store",
    });
    return new Response(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ detail: "Processing service is unavailable." }, { status: 503 });
  }
}
