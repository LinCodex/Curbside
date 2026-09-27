// Stub for `cloudflare:workers` used during Vercel builds where the
// Cloudflare Workers runtime is unavailable. The real module is provided
// at runtime on Cloudflare; this shim lets the Vite/Rolldown bundler
// resolve the import without errors.
//
// On Vercel, lib/runtime.ts catches the failed import and falls back to
// process.env, so this stub is only needed at bundle time.

export const env = typeof process !== "undefined" ? process.env : {};
