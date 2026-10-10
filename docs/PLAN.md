# Freerec — All-in-one PDF & Image Utility Platform: Audit + Plan

## Context

`svimran46/Freerec` is an empty repo: one commit with a 9-byte `README.md`. There is no existing code, pattern, or utility to reuse, so this is a greenfield build. The goal is an **original** all-in-one PDF and file utility site, in the category of pdfguru.com, plus image tools: compress with an adjustable quality setting, resize, convert, and upscale.

Decisions confirmed with the user:
- **Hybrid processing.** Work runs in the browser (WASM / Web Workers) when the tool allows it. Heavy work runs on server workers.
- **Stack.** Next.js (TypeScript) for the frontend and the thin API. Python/FastAPI workers run in Docker. Redis handles the queue and S3-compatible storage holds files.
- **Business model.** Free, no accounts in v1. Abuse is controlled with rate limits and size caps, and files are deleted automatically.
- **MVP scope.** Core PDF organize tools, Image tools, and Conversions. Edit, sign, OCR, and AI tools come after the MVP.

## Reference-site access (finding)

- **pdfguru.com could not be audited directly.** The environment's network policy denies the host: the proxy returned 403 on CONNECT, and WebFetch could not reach any external host. The user can allow `pdfguru.com` under the cloud environment's Network access settings: https://code.claude.com/docs/en/cloud-environments#network-access.
- The inventory below therefore comes from WebSearch result snippets: pdfguru.com page titles, the PDF Association member listing, and third-party reviews (UPDF, SwifDoo, Trustpilot). It is secondhand. It should be re-verified, either with the site allowed or by the user clicking through the site.

## Reference feature inventory (from search results only)

| Area | What the reference reportedly offers |
|---|---|
| Edit | Edit text, fonts and colors; highlight and annotate; add images, shapes, links and checkmarks |
| Organize | Merge, split, rotate, reorder, delete and extract pages |
| Optimize | Compress PDF |
| Convert (35+ tools) | PDF ↔ Word, Excel, PPTX, JPG, PNG, TIFF, SVG, WebP, HTML, EPUB, MOBI; a separate ebook converter (EPUB/MOBI/AZW) |
| OCR | Scans or images to searchable PDF or editable text; claims 190+ languages and handwriting |
| Sign / Forms | E-signature, fill PDF, create fillable forms, a template library (W-9, W-2, I-9, Bill of Sale; "1,000+ templates") |
| AI | Summarize PDFs and books, translate documents (claims 90+ languages); "AI chat" is unconfirmed |
| Business model | No free tier. Reported prices: $0.99 or $1.99 7-day trial that auto-renews to $49.99/mo, or $299/yr. Downloads are paywalled. Trustpilot shows many complaints about surprise renewals |
| Limits | Reported as 50 MB or 100 MB (sources disagree) |
| Scale | Claims 15M users, 25 UI languages, and web plus mobile apps |

**Typical workflow:** pick a tool → upload or drag a file → set options → process → preview → (paywall) → download.

**Differentiation for Freerec:** free with no account, transparent limits, privacy-first in-browser processing where possible, files auto-deleted within 1 hour, and no dark-pattern trial. The image tool suite is a gap in the reference. All branding, copy, UI, and templates must be original; nothing is copied from the reference.

## Freerec MVP feature inventory

**A. PDF organize (client-side; files never leave the device)**
- Merge (reorder by drag), split (by ranges, every N pages, or extract selected), rotate, reorder or delete pages via a thumbnail grid, extract pages.
- Libraries: `pdf-lib` for page manipulation and `pdfjs-dist` for thumbnails and rendering.

**B. Image tools**
- **Compress.** A quality slider (1–100), output format choice (keep / JPEG / WebP / AVIF / PNG), a before/after comparison slider, a live size estimate, and an option to strip metadata. Client-side with `@jsquash/*` WASM codecs (mozjpeg, webp, avif, oxipng).
- **Resize.** By pixels, percent, or presets (social sizes), with aspect lock and fit modes (contain / cover / stretch). Client-side with `pica` (Lanczos3).
- **Convert.** Between JPG, PNG, WebP, AVIF, and GIF (first frame). HEIC input uses `libheif-js`.
- **Upscale.** 2× / 4× runs server-side with Real-ESRGAN (`realesrgan-x4plus`, BSD-3 weights) on ONNX Runtime. A "Classic" Lanczos mode runs instantly in the browser. Input is capped by megapixels.
- **Batch.** Multiple files process in Web Workers and download as a ZIP (`fflate`).

**C. Conversions (server-side)**
- **Compress PDF:** Ghostscript presets (high / balanced / small), followed by qpdf linearize.
- **Office/ODF/RTF/TXT → PDF:** headless LibreOffice.
- **PDF → Word / Excel / PPTX:** `pdf2docx` for Word, `pdfplumber` (tables) → `openpyxl` for Excel, and page images → `python-pptx` for PPTX.
- **PDF → images (JPG/PNG/WebP/TIFF):** in the browser via pdf.js, with a server fallback through `pypdfium2` for large files. **Images → PDF:** client-side with pdf-lib.
- **HTML / URL → PDF:** headless Chromium (Playwright) with an SSRF-guarded fetch.
- **Ebooks (EPUB / MOBI / AZW3 ↔ PDF):** Calibre `ebook-convert`.

**Post-MVP backlog:** protect/unlock, watermark, page numbers, annotate/edit, e-sign, fill and create forms, OCR (`ocrmypdf` + Tesseract), PDF/A, compare PDFs, AI summarize/translate (Claude API), accounts and billing, i18n, mobile PWA.

## Architecture

```
Browser (Next.js app)
 ├─ Tool pages (/tools/[slug]) driven by a typed tool registry
 ├─ Web Workers: pdf-lib, pdf.js, jsquash codecs, pica  ← client-side tools
 └─ Server tools: POST /api/jobs → presigned PUT to storage → poll/SSE → presigned GET
                         │
Next.js route handlers (thin BFF): validation, rate limit (Redis), Turnstile check
                         │
FastAPI "api" service ── Redis (job queue + job state + rate counters)
                         │
Python workers (Docker, isolated per op class):
   doc-worker:   LibreOffice, Ghostscript, qpdf, pdf2docx, pdfplumber, Calibre, Chromium
   image-worker: Pillow/pyvips, ONNX Runtime + Real-ESRGAN (CPU now; GPU optional)
                         │
S3-compatible storage (MinIO locally, Cloudflare R2 in prod) with a 1-hour lifecycle delete
```

- **Job lifecycle:** `created → uploaded → queued → running → done | failed | expired`. State lives in Redis with a TTL. v1 has no database.
- **Contract:** FastAPI produces OpenAPI, and `openapi-typescript` generates the typed TS client the web app uses.
- **Tool registry** (`apps/web/src/tools/registry.ts`): slug, title, category, accepted MIME types, limits, `runtime: "client" | "server"`, options schema (zod), and SEO metadata. One generic `ToolPage` renders upload → options → process → result for every tool.

### Repo layout (as built in Phase 0)

```
apps/web/                 Next.js 16 App Router, Tailwind 4, zod, Vitest
  src/tools/registry.ts   every tool: slug, category, runtime, accepted kinds, limits
  src/tools/processors.ts browser processors by slug (filled from Phase 1)
  src/lib/                file-kind sniffing, validation, ZIP/download, job API client
  src/app/api/jobs/       thin proxy to the backend (rate limits/bot checks land here)
services/backend/         one Python package, several entrypoints
  src/freerec/api.py      FastAPI job API (create → presigned POST → submit → poll → delete)
  src/freerec/worker.py   RQ job execution; ops/ holds one module per server tool
  src/freerec/janitor.py  deletes expired jobs' files within a minute (S3 lifecycle is daily)
infra/docker-compose.yml  web, api, worker, janitor, redis, SeaweedFS (S3), storage-setup
scripts/smoke.py          end-to-end check run in CI against the compose stack
.github/workflows/ci.yml  lint, typecheck, unit tests, build, compose smoke test
```

Deviations from the original proposal:
- **One backend package instead of separate `api/` and `worker/` services.** They share the
  job model, storage and file sniffing. The heavy doc-worker and image-worker images will
  extend the same package in Phases 2–3.
- **SeaweedFS instead of MinIO for local S3.** MinIO no longer publishes community images
  on Docker Hub. Production still targets Cloudflare R2 or S3.
- **Presigned POST (not PUT).** This lets storage enforce the size limit with a
  `content-length-range` policy, and the API re-checks object sizes on submit.

## Technical requirements

- **Limits (proposed defaults):** 100 MB per file, 20 files per batch, 500 PDF pages, 50 MP image input, upscale input ≤ 4 MP (2×) or ≤ 1 MP (4×), and 120 s job timeout.
- **Security:**
  - Sniff file types by magic bytes, not by extension.
  - Guard against decompression bombs (Pillow `MAX_IMAGE_PIXELS`, page caps).
  - Workers run as non-root, with no network egress (except the URL→PDF fetcher behind an SSRF allowlist), and with CPU, memory, and pids limits and per-op timeouts.
  - Disable LibreOffice macros.
  - Use presigned URLs with short expiry and random object keys. Never log file contents. Delete files 1 hour after the job and on user request.
- **Privacy UX:** a badge on each tool shows "Processed on your device" or "Processed on our server, deleted in 1 h".
- **Performance:** client ops run in Web Workers so the UI never blocks. WASM codecs are lazy-loaded per tool. Large-file progress is streamed.
- **Accessibility:** a keyboard-operable dropzone and page grid, and WCAG 2.2 AA contrast.
- **SEO:** one statically generated landing page per tool with original copy.
- **Observability:** Sentry (web + Python), structured logs, and per-op job duration and failure metrics.

## Unknowns and risks (need decisions before or during build)

1. **Reference inventory is unverified.** The site was blocked. Allow `pdfguru.com` in network settings, or accept the secondhand inventory.
2. **License exposure for a hosted service.**
   - Ghostscript and PyMuPDF are AGPL, which is why PyMuPDF is avoided in favor of `pypdfium2` and `pdf-lib`.
   - `pdf2docx` and Calibre are GPL-3. libheif is LGPL.
   - Running these as separate CLI processes on a server is generally fine. AGPL Ghostscript still needs a decision: either publish source for any modifications (none are planned), or replace it with qpdf + image recompression via `pikepdf`.
   - **The user should confirm their license policy.**
3. **PDF → Word/PPT fidelity.** The open-source quality is "good, not Acrobat". A commercial SDK could be added later behind the same op interface.
4. **Upscaling compute.** CPU Real-ESRGAN takes tens of seconds per MP. Options are to keep strict caps or add a GPU worker (RunPod, Modal, or a GPU instance). **The budget is unknown.**
5. **Hosting and budget.** The planned split is Vercel for web and a container host (Render, Fly, or Cloud Run) for the api and workers. The doc-worker image is about 1.5–2 GB because of LibreOffice, Chromium, and Calibre.
6. **Product details still open.** Brand name and domain (is "Freerec" final?), retention window, analytics and ads, and target UI languages.
7. **Abuse.** Anonymous free compute attracts bots, so Turnstile and per-IP and per-ASN quotas are needed from day one.

## Phased implementation plan

**Phase 0: Foundations (about 1 week) — done**
- Monorepo scaffold (pnpm workspaces + uv for Python) and docker-compose for local dev.
- CI with lint, typecheck, and tests.
- Design tokens and layout, the tool registry, the generic `ToolPage`, the Dropzone, and download/ZIP utilities.
- FastAPI job API with presigned upload/download, Redis job state, a no-op worker, and the storage TTL lifecycle.

**Phase 1: Client-side PDF organize (about 1 week)**
- Merge, split, rotate, reorder/delete, and extract pages.
- PDF→JPG/PNG and Images→PDF.
- Page-thumbnail grid component.

**Phase 2: Image suite (about 1.5 weeks)**
- Compress (quality slider, before/after, size estimate), resize, convert (with HEIC input), and batch + ZIP. All client-side.
- Upscale: Classic mode client-side; AI 2×/4× on the image-worker (ONNX Real-ESRGAN) with caps and a progress display.

**Phase 3: Server conversions (about 2 weeks)**
- Compress PDF, Office→PDF, PDF→Word/Excel/PPTX, HTML/URL→PDF, and ebook conversions.
- Each op is an isolated module with golden-file tests.

**Phase 4: Hardening and launch (about 1 week)**
- Rate limits, Turnstile, worker sandboxing review, and a malformed-file fuzz set.
- Sentry and metrics, the privacy policy and terms pages, per-tool SEO pages, an accessibility pass, a load test, and production deploy.

**Phase 5+: Post-MVP**
- Security tools (protect/unlock, watermark, page numbers).
- OCR, sign and fill, and an annotate editor.
- AI summarize/translate.
- Accounts and billing, if monetization is chosen.

## Verification

- **Unit tests per op.**
  - Client ops (Vitest) and server ops (pytest) run against a fixtures corpus: multi-page, encrypted, scanned, and malformed PDFs; DOCX, XLSX, PPTX, and EPUB files; and JPG, PNG, HEIC, and AVIF images.
  - Assertions check page counts, rotation, text presence, output MIME type, and size reduction.
  - Image compression checks SSIM against the quality setting. Upscale checks output dimensions.
- **End-to-end.** Playwright runs each tool page: upload fixture → set options → download → validate the output. This runs in CI against `docker compose up`, using the pre-installed Chromium.
- **Security.** Run the fuzz set (zip/decompression bombs, malformed xref, macro-laden DOCX). Workers must fail cleanly within the timeout and never crash the queue.
- **Manual.** Run `docker compose up`, open `http://localhost:3000`, and exercise every MVP tool. Confirm in the network tab that client-side tools make no upload.
