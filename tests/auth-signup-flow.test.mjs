import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

await mkdir("work", { recursive: true });
const output = path.resolve("work/auth-signup-test.mjs");
await build({
  entryPoints: ["components/auth-panel.tsx"],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["react", "lucide-react"],
  plugins: [
    {
      name: "isolate-auth-ui",
      setup(builder) {
        builder.onResolve(
          {
            filter:
              /^\.\/(preferences|use-supabase-account|bot-challenge|auth-panel\.module\.css)$/,
          },
          (args) => ({ path: args.path, namespace: "auth-test" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "auth-test" }, (args) => ({
          loader: "js",
          contents:
            args.path === "./preferences"
              ? "export function usePreferences(){return{tr:value=>value,savedPreferences:{}}}"
              : args.path === "./use-supabase-account"
                ? "export function useSupabaseAccount(){return{configuration:{}}}"
                : args.path === "./bot-challenge"
                  ? "export default {}; export function CaptchaDisclosure(){return null}"
                  : "export default {}",
        }));
      },
    },
  ],
});
const { signupNeedsSignIn } = await import(pathToFileURL(output));

test("signup recovery handles both explicit duplicate email error codes", () => {
  assert.equal(signupNeedsSignIn(null, "user_already_exists"), true);
  assert.equal(signupNeedsSignIn(null, "email_exists"), true);
});
test("Supabase's obfuscated existing-user response does not show signup success", () => {
  assert.equal(signupNeedsSignIn({ identities: [] }), true);
});
test("a new unconfirmed email identity can proceed to verification", () => {
  assert.equal(
    signupNeedsSignIn({ identities: [{ provider: "email" }] }),
    false,
  );
});
test("unrelated authentication errors do not claim that an email exists", () => {
  assert.equal(signupNeedsSignIn(null, "captcha_failed"), false);
  assert.equal(signupNeedsSignIn(null, "over_email_send_rate_limit"), false);
  assert.equal(signupNeedsSignIn(null, "invalid_credentials"), false);
  assert.equal(signupNeedsSignIn({}), false);
});
