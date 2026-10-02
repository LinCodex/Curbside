import { build } from "esbuild";
await build({
  entryPoints: ["supabase/functions/email-notifications/index.ts"],
  outfile: "work/email-notifications/index.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  external: ["npm:@supabase/supabase-js@2.117.2"],
  alias: { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.117.2" },
});
