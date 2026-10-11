# Deploying Freerec

The web app runs on **Cloudflare Workers**, built with the
[OpenNext adapter](https://opennext.js.org/cloudflare). Every PDF and image tool so far
runs in the visitor's browser, so the Worker only serves pages and static files.
The processing backend for server tools (Phase 3) will be added separately.

## How it deploys

`.github/workflows/deploy.yml` runs on every push to `main` (and on demand from the
Actions tab). It builds the Worker with `pnpm --filter web build:cloudflare` and
deploys it with Wrangler as the Worker named **`freerec`**.

The site is then live at `https://freerec.<your-subdomain>.workers.dev`. The deploy
job prints the exact URL and links it from the run's summary.

## One-time setup

You need two repository secrets. Until both exist, the deploy job skips itself with a
warning instead of failing.

1. **Create an API token** in the Cloudflare dashboard:
   1. Go to **My Profile → API Tokens → Create Token**.
   2. Pick the **Edit Cloudflare Workers** template.
   3. Under **Account Resources**, choose your account. Under **Zone Resources**,
      choose *All zones* (or only the zone you'll use for a custom domain).
   4. Click **Continue to summary → Create Token**, and copy the token. Cloudflare
      shows it only once.
2. **Find your account ID.** It's under **Workers & Pages** on the right side of the
   overview page, or in the dashboard URL after `dash.cloudflare.com/`.
3. **Add both as GitHub secrets.** In the repository, go to **Settings → Secrets and
   variables → Actions → New repository secret** and add:
   - `CLOUDFLARE_API_TOKEN`: the token from step 1
   - `CLOUDFLARE_ACCOUNT_ID`: the ID from step 2
4. **Deploy.** Go to **Actions → Deploy → Run workflow**, or merge any PR into `main`.

Never paste the token anywhere else: not in code, not in an issue, not in chat.

## Custom domain

Once the domain's DNS is on Cloudflare:

1. Go to **Workers & Pages → freerec → Settings → Domains & Routes**.
2. Click **Add → Custom domain** and enter it, for example `freerec.app`.

Cloudflare creates the DNS record and the HTTPS certificate.

## Run the Cloudflare build locally

```sh
pnpm --filter web build:cloudflare      # next build + OpenNext bundle into apps/web/.open-next
pnpm --filter web preview:cloudflare    # serves it in the Workers runtime at http://localhost:8787
E2E_BASE_URL=http://localhost:8787 pnpm --filter web test:e2e   # browser tests against it
```

CI runs `build:cloudflare` on every PR, so a change that breaks the Worker build
fails before it reaches `main`.

## Details worth knowing

- **Caching.** Every page is prerendered and nothing revalidates, so `open-next.config.ts`
  serves prerendered output from Workers static assets. No R2 or KV cache is needed.
- **Size.** The Worker script is about 1.5 MB gzipped, under the 3 MB limit of the free
  plan. The WebAssembly codecs, pdf.js files, and images are static assets, which have
  their own per-file limit of 25 MiB; the largest is about 2 MB.
- **Adapter patch.** `patches/@opennextjs__cloudflare@1.20.10.patch` adds one pattern
  to the adapter. Next.js 16.4 loads `server/preview-props.json` at runtime, and
  adapter 1.20.10 doesn't bundle that file into the Worker, so every page returned
  `Unexpected loadManifest(/.next/server/preview-props.json) call!` (HTTP 500). The
  patch adds `preview-props` to the files the adapter inlines. Drop it once the
  adapter handles the file itself; `pnpm install` will fail loudly if the patched
  version changes.
- **`/api/jobs`.** This answers `503 Processing service is unavailable` until the
  backend exists. Phase 3 will set `BACKEND_URL` in `wrangler.jsonc`.
- **Docker.** The Docker image (`apps/web/Dockerfile`, used by `infra/docker-compose.yml`)
  still works for local development and for self-hosting.
