import { build } from "esbuild";
await build({
  entryPoints: ["supabase/functions/account-delete/index.ts"],
  outfile: "work/account-delete/index.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  external: ["npm:@supabase/supabase-js@2.117.2"],
  alias: { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.117.2" },
});
