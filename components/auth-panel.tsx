"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { usePreferences } from "./preferences";

export default function AuthPanel({
  client,
  recovering,
  onComplete,
}: {
  client: SupabaseClient;
  recovering: boolean;
  onComplete: () => void;
}) {
  const { tr } = usePreferences();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = recovering
        ? await client.auth.updateUser({ password })
        : mode === "register"
          ? await client.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin + "/" },
            })
          : mode === "reset"
            ? await client.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + "/?auth=recovery",
              })
            : await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        const code = result.error.code;
        if (code === "invalid_credentials")
          setError(tr("Email or password is incorrect."));
        else if (code === "email_not_confirmed")
          setError(tr("Verify your email before signing in."));
        else if (code === "weak_password")
          setError(
            tr("Choose a stronger password with at least 8 characters."),
          );
        else if (
          ["over_request_rate_limit", "over_email_send_rate_limit"].includes(
            code || "",
          )
        )
          setError(tr("Too many attempts. Please wait before trying again."));
        else
          setError(
            tr("Sign-in is unavailable right now. Please try again later."),
          );
        return;
      }
      if (recovering) {
        await client.auth.signOut();
        onComplete();
      } else if (mode === "reset")
        setMessage(
          tr(
            "If an account exists, a password reset link will arrive by email.",
          ),
        );
      else if (
        mode === "register" &&
        !("session" in result.data && result.data.session)
      )
        setMessage(
          tr(
            "Check your email to confirm your account, then sign in. If you already have an account, use Sign in.",
          ),
        );
      else onComplete();
    } catch {
      setError(tr("Could not connect. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack auth-panel">
      <div className="auth-intro">
        <span className="account-profile-mark">
          <ShieldCheck size={22} />
        </span>
        <p>{tr("Your saved cars, wherever you sign in.")}</p>
      </div>
      {!recovering && (
        <div className="segmented auth-tabs" aria-label={tr("Account access")}>
          {(["login", "register"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={mode === tab}
              disabled={busy}
              className={mode === tab ? "active" : ""}
              onClick={() => {
                setMode(tab);
                setError("");
                setMessage("");
              }}
            >
              {tr(tab === "login" ? "Sign in" : "Create account")}
            </button>
          ))}
        </div>
      )}
      <form className="stack" onSubmit={submit}>
        {mode === "reset" && !recovering && (
          <p className="small muted">
            {tr("We’ll email you a link to reset your password.")}
          </p>
        )}
        {!recovering && (
          <label className="field">
            {tr("Email address")}
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              disabled={busy}
            />
          </label>
        )}
        {(recovering || mode !== "reset") && (
          <label className="field">
            {tr(recovering ? "New password" : "Password")}
            <div className="password-field">
              <input
                type={visible ? "text" : "password"}
                name="password"
                autoComplete={
                  recovering || mode === "register"
                    ? "new-password"
                    : "current-password"
                }
                minLength={mode === "login" && !recovering ? undefined : 8}
                maxLength={128}
                required
                disabled={busy}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={tr(visible ? "Hide password" : "Show password")}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        )}
        {(recovering || mode === "register") && (
          <p className="small muted">
            {tr(
              "Use at least 8 characters. A longer, unique password is best.",
            )}
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            <Mail size={17} /> {message}
          </p>
        )}
        <button className="primary-action" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}{" "}
          {tr(
            recovering
              ? "Save new password"
              : mode === "register"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in",
          )}
        </button>
      </form>
      {!recovering && (
        <button
          className="text-link"
          disabled={busy}
          onClick={() => {
            setMode(mode === "reset" ? "login" : "reset");
            setError("");
            setMessage("");
          }}
        >
          {tr(mode === "reset" ? "Back to sign in" : "Forgot password?")}
        </button>
      )}
      <p className="small muted">
        {tr("Saving cars does not enable monitoring or alerts.")}
      </p>
      <p className="consent-links">
        <a href="/legal/terms" target="_blank" rel="noreferrer">
          {tr("Terms of Service")}
        </a>{" "}
        ·{" "}
        <a href="/legal/privacy" target="_blank" rel="noreferrer">
          {tr("Privacy Policy")}
        </a>
      </p>
    </div>
  );
}
