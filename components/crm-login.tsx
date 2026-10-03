"use client";

import { useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import BotChallenge, {
  CaptchaDisclosure,
  type ChallengeHandle,
} from "./bot-challenge";
import {
  meetsPasswordRequirement,
  PASSWORD_REQUIREMENT,
} from "@/lib/password-policy";

const ignoreToken = () => {};

export default function CrmLogin({
  client,
  captchaKey,
  recovering,
  onComplete,
  tr,
}: {
  client: SupabaseClient;
  captchaKey: string | null | undefined;
  recovering: boolean;
  onComplete: () => void;
  tr: (text: string) => string;
}) {
  const challenge = useRef<ChallengeHandle>(null);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetKey, setResetKey] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (recovering && !meetsPasswordRequirement(password)) {
      setError(tr(PASSWORD_REQUIREMENT));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let captchaToken: string | undefined;
      if (!recovering && captchaKey) {
        try {
          if (!challenge.current) throw new Error("Challenge unavailable");
          captchaToken = await challenge.current.execute();
        } catch {
          setError(tr("Security check failed. Please try again."));
          return;
        }
      }
      const result = recovering
        ? await client.auth.updateUser({ password })
        : mode === "reset"
          ? await client.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: window.location.origin + "/?auth=recovery",
              captchaToken,
            })
          : await client.auth.signInWithPassword({
              email: email.trim(),
              password,
              options: { captchaToken },
            });
      if (result.error) {
        const code = result.error.code || "";
        setError(
          tr(
            code === "invalid_credentials"
              ? "Email or password is incorrect."
              : code === "email_not_confirmed"
                ? "Confirm your email before signing in."
                : code === "captcha_failed"
                  ? "Security check failed. Please try again."
                  : code === "weak_password"
                    ? PASSWORD_REQUIREMENT
                    : [
                          "over_request_rate_limit",
                          "over_email_send_rate_limit",
                        ].includes(code)
                      ? "Too many attempts. Please wait before trying again."
                      : "Sign-in is unavailable right now. Please try again later.",
          ),
        );
        return;
      }
      if (recovering) {
        const signOut = await client.auth.signOut();
        if (signOut.error) throw signOut.error;
        onComplete();
      } else if (mode === "reset") {
        setMessage(
          tr("If you have an account, check your inbox for a reset link."),
        );
      } else onComplete();
    } catch {
      setError(tr("Could not connect. Check your connection and try again."));
    } finally {
      setBusy(false);
      setResetKey((value) => value + 1);
    }
  }

  return (
    <div className="crm-login">
      <form
        className="crm-login-form"
        onSubmit={submit}
        aria-label={tr("Admin sign in")}
      >
        {!recovering && (
          <label className="crm-login-field">
            {tr("Email address")}
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              inputMode="email"
              maxLength={254}
              required
              disabled={busy}
            />
          </label>
        )}
        {(recovering || mode === "login") && (
          <label className="crm-login-field">
            {tr(recovering ? "New password" : "Password")}
            <div className="crm-login-password">
              <input
                type={visible ? "text" : "password"}
                name="password"
                autoComplete={recovering ? "new-password" : "current-password"}
                minLength={recovering ? 8 : undefined}
                maxLength={128}
                aria-describedby={
                  recovering ? "crm-password-requirement" : undefined
                }
                required
                disabled={busy}
              />
              <button
                className="crm-login-reveal"
                type="button"
                aria-label={tr(visible ? "Hide password" : "Show password")}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        )}
        {recovering && (
          <p className="crm-login-message" id="crm-password-requirement">
            {tr(PASSWORD_REQUIREMENT)}
          </p>
        )}
        {error && (
          <p className="crm-login-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="crm-login-message" role="status">
            {message}
          </p>
        )}
        {!recovering && captchaKey && (
          <BotChallenge
            ref={challenge}
            siteKey={captchaKey}
            mode="invisible"
            showDisclosure={false}
            onToken={ignoreToken}
            resetKey={resetKey}
          />
        )}
        <button
          className="crm-button crm-primary crm-login-submit"
          type="submit"
          disabled={busy}
        >
          {tr(
            busy
              ? "Please wait…"
              : recovering
                ? "Save new password"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in",
          )}
          {busy ? (
            <LoaderCircle className="crm-spinner" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}
        </button>
      </form>
      {!recovering && (
        <button
          className="crm-login-link"
          type="button"
          disabled={busy}
          onClick={() => {
            setMode(mode === "login" ? "reset" : "login");
            setError("");
            setMessage("");
          }}
        >
          {tr(mode === "login" ? "Forgot password?" : "Back to sign in")}
        </button>
      )}
      {!recovering && captchaKey && <CaptchaDisclosure />}
    </div>
  );
}
