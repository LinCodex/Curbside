import { build } from "esbuild";
await build({
  entryPoints: ["supabase/functions/crm-admin/index.ts"],
  outfile: "work/crm-admin/index.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  external: ["npm:@supabase/supabase-js@2.117.2"],
  alias: { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.117.2" },
});
