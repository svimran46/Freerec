import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copied from pdfjs-dist by scripts/copy-pdfjs-assets.mjs.
    "public/pdfjs/**",
    // Cloudflare (OpenNext and Wrangler) build output.
    ".open-next/**",
    ".wrangler/**",
    // Playwright output.
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
