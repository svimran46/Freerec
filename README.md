# Freerec

Free, all-in-one PDF and image tools: merge, split, convert and compress PDFs;
compress (with an adjustable quality setting), resize, convert and upscale images.
No account, no trial, no watermark. Tools run in the browser wherever possible;
the rest run on short-lived server jobs whose files are deleted within an hour.

See [docs/PLAN.md](docs/PLAN.md) for the feature inventory, architecture and roadmap, and
[docs/DEPLOY.md](docs/DEPLOY.md) for hosting on Cloudflare Workers.

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Foundations: monorepo, tool registry and pages, upload UI, job API, worker, storage, CI | Done |
| 1 | Client-side PDF organize (merge, split, rotate, reorder, extract, PDF↔image) | Done |
| 2 | Image suite (compress, resize, convert, upscale) | Done; AI upscaling awaits a hosting decision |
| 3 | Server conversions (compress PDF, Office, PDF→Office, HTML, ebooks) | Done; live once a backend is deployed |
| 4 | Hardening and launch | Next |

Every tool already has its page; tools without an implementation show "under construction".

## Layout

```
apps/web/          Next.js app: tool registry, tool pages, upload UI, /api/jobs proxy
services/backend/  Python: FastAPI job API, RQ worker, janitor, server-side ops
infra/             docker-compose stack for local development
scripts/smoke.py   End-to-end check against a running stack
docs/PLAN.md       Feature inventory, architecture, roadmap
docs/DEPLOY.md     Cloudflare Workers deployment and one-time setup
```

## Run everything

```sh
docker compose -f infra/docker-compose.yml up --build
python3 scripts/smoke.py   # in another terminal
```

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs
- S3 (SeaweedFS): http://localhost:8333

## Develop

Web (Node 22, pnpm):

```sh
pnpm install
pnpm --filter web dev        # needs the backend running for server tools
pnpm --filter web test
pnpm --filter web lint && pnpm --filter web typecheck

# Browser tests for the on-device tools (Chromium via Playwright)
pnpm --filter web build && pnpm --filter web test:e2e

# Cloudflare Workers build and local preview (see docs/DEPLOY.md)
pnpm --filter web build:cloudflare && pnpm --filter web preview:cloudflare
```

Backend (Python 3.12+, uv):

```sh
cd services/backend
uv sync --extra docs          # the conversion libraries
uv run pytest                 # conversion tests skip when LibreOffice, Ghostscript, qpdf,
                              # Calibre, or Chromium is missing; CI installs them all
uv run ruff check . && uv run ruff format --check .
```

The `docker compose` stack builds the worker image with every converter and turns the
server tools on in its web build.

## Adding a tool

1. Add its definition to `apps/web/src/tools/registry.ts`.
2. Write its implementation with `defineTool` (`apps/web/src/tools/types.ts`): initial
   settings, an optional settings panel, an optional `blocker` that says why it can't run
   yet, and `process`. Register it in `apps/web/src/tools/implementations.ts`.
3. Browser tools live in `apps/web/src/tools/client/`. Heavy PDF edits go through
   `runPdfOp` (a cancellable Web Worker); page previews use `PageGrid` and `usePdfDocument`.
4. For a server tool, add a module under `services/backend/src/freerec/ops/`, register it in
   `_all_ops`, and call `runServerJob` from `apps/web/src/lib/api/jobs.ts` in `process`.
