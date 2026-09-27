// Stub for `cloudflare:workers` used during Vercel builds where the
// Cloudflare Workers runtime is unavailable.  The real module is provided
// at runtime on Cloudflare; this shim lets the Vite/Rolldown bundler
// resolve the import without errors.  API routes that depend on `env`
// will return empty config / throw at call-time, but the static client
// build completes successfully.

export const env = {};
