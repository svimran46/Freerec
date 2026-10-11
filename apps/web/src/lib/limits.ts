/** Default limits for anonymous use. Tools may tighten these, never loosen them. */
export const LIMITS = {
  maxFileBytes: 100 * 1024 * 1024,
  maxFiles: 20,
  /** How long server-processed files are kept before automatic deletion. */
  retentionMinutes: 60,
} as const;
