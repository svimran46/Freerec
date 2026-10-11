import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page is prerendered at build time and nothing revalidates, so the
// prerendered output is served straight from Workers static assets; no R2 or KV
// cache is needed.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
