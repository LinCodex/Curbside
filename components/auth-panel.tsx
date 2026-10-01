"use client";
import { useEffect, useState } from "react";
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
import { useSupabaseAccount } from "./use-supabase-account";
import BotChallenge from "./bot-challenge";
import {
  meetsPasswordRequirement,
  PASSWORD_REQUIREMENT,
} from "../lib/password-policy";

export default function AuthPanel({
  client,
  recovering,
  onComplete,
  initialMode = "login",
  initialEmail = "",
}: {
  client: SupabaseClient;
  recovering: boolean;
  onComplete: () => void;
  initialMode?: "login" | "register" | "reset";
  initialEmail?: string;
}) {
  const { tr, savedPreferences } = usePreferences();
  const captchaKey = useSupabaseAccount().configuration.hcaptchaKey;
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [mode, setMode] = useState<"login" | "register" | "reset">(initialMode);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const rememberSent = (email: string) => {
    const until = Date.now() + 60_000;
    setResendAt(until);
    setRemaining(60);
    try {
      sessionStorage.setItem(
        "curbside.confirmation." + email.toLowerCase(),
        String(until),
      );
    } catch {}
  };
  const pendingConfirmation = (email: string) => {
    setPendingEmail(email);
    try {
      setResendAt(
        Number(
          sessionStorage.getItem(
            "curbside.confirmation." + email.toLowerCase(),
          ),
        ) || 0,
      );
    } catch {}
  };
  useEffect(() => {
    if (!pendingEmail) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pendingEmail, resendAt]);
  const resend = async () => {
    if (busy || remaining > 0 || !pendingEmail) return;
    if (captchaKey && !captchaToken) {
      setError(tr("Complete the security check."));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    rememberSent(pendingEmail);
    try {
      const result = await client.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: {
          emailRedirectTo: window.location.origin + "/",
          captchaToken,
        },
      });
      if (result.error)
        setError(
          tr("Could not resend yet. Please wait a minute and try again."),
        );
      else
        setMessage(
          tr(
            "If confirmation is still needed, a fresh link will arrive by email. Check your inbox and spam folder.",
          ),
        );
    } catch {
      setError(tr("Could not connect. Check your connection and try again."));
    } finally {
      setBusy(false);
      setCaptchaReset((value) => value + 1);
    }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!recovering && captchaKey && !captchaToken) {
      setError(tr("Complete the security check."));
      return;
    }
    if (
      (recovering || mode === "register") &&
      !meetsPasswordRequirement(password)
    ) {
      setError(tr(PASSWORD_REQUIREMENT));
      setMessage("");
      return;
    }
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
              options: {
                emailRedirectTo: window.location.origin + "/",
                data: { curbside_preferences: savedPreferences },
                captchaToken,
              },
            })
          : mode === "reset"
            ? await client.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + "/?auth=recovery",
                captchaToken,
              })
            : await client.auth.signInWithPassword({
                email,
                password,
                options: { captchaToken },
              });
      if (result.error) {
        const code = result.error.code;
        if (code === "captcha_failed") {
          setError(tr("Security check failed. Please try again."));
          return;
        }
        if (code === "invalid_credentials")
          setError(tr("Email or password is incorrect."));
        else if (code === "email_not_confirmed") {
          pendingConfirmation(email);
          setError(
            tr(
              "Verify your email before signing in. Check your inbox and spam folder.",
            ),
          );
        } else if (code === "weak_password") setError(tr(PASSWORD_REQUIREMENT));
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
            "If an account exists, a password reset link will arrive by email. Check your inbox and spam folder.",
          ),
        );
      else if (
        mode === "register" &&
        !("session" in result.data && result.data.session)
      ) {
        setPendingEmail(email);
        rememberSent(email);
        setMessage(
          tr(
            "Confirm your email to activate your account. Check your inbox and spam folder, then sign in. If you already have an account, use Sign in.",
          ),
        );
      } else onComplete();
    } catch {
      setError(tr("Could not connect. Check your connection and try again."));
    } finally {
      setBusy(false);
      setCaptchaReset((value) => value + 1);
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
              defaultValue={initialEmail}
              readOnly={mode === "reset" && !!initialEmail}
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
                aria-describedby={
                  recovering || mode === "register"
                    ? "password-requirement"
                    : undefined
                }
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
          <p id="password-requirement" className="small muted">
            {tr(PASSWORD_REQUIREMENT)}
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
        {!recovering && captchaKey && (
          <BotChallenge
            siteKey={captchaKey}
            onToken={setCaptchaToken}
            resetKey={captchaReset}
          />
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
      {!recovering && pendingEmail && mode !== "reset" && (
        <div className="confirmation-resend">
          <p className="small muted">
            {tr("Your account stays inactive until your email is confirmed.")}
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={busy || remaining > 0}
            onClick={resend}
          >
            <Mail size={16} /> {tr("Resend confirmation")}
            {remaining > 0 && (
              <span className="mono">
                {" "}
                ({remaining}
                {tr("s")})
              </span>
            )}
          </button>
        </div>
      )}
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
        {tr(
          "Saved histories refresh every morning. Email and SMS reminders are not activated yet.",
        )}
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
