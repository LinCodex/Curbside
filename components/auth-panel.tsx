"use client";
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Check,
  LogIn,
} from "lucide-react";
import styles from "./auth-panel.module.css";
import { usePreferences } from "./preferences";
import { useSupabaseAccount } from "./use-supabase-account";
import BotChallenge from "./bot-challenge";
import {
  meetsPasswordRequirement,
  PASSWORD_REQUIREMENT,
} from "../lib/password-policy";

export function signupNeedsSignIn(
  user: { identities?: unknown[] } | null,
  code?: string,
) {
  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    (!!user && Array.isArray(user.identities) && user.identities.length === 0)
  );
}

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
  const [email, setEmail] = useState(initialEmail);
  const [stage, setStage] = useState<"form" | "confirmation" | "existing">(
    "form",
  );
  const [showResendChallenge, setShowResendChallenge] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
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
    setStage("confirmation");
    setShowResendChallenge(false);
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
    if (stage === "form") emailInput.current?.focus();
    else heading.current?.focus();
  }, [stage]);
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
      setShowResendChallenge(false);
      setCaptchaToken("");
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
        if (mode === "register" && signupNeedsSignIn(null, code)) {
          setPendingEmail(email);
          setStage("existing");
          return;
        }
        if (code === "captcha_failed") {
          setError(tr("Security check failed. Please try again."));
          return;
        }
        if (code === "invalid_credentials")
          setError(tr("Email or password is incorrect."));
        else if (code === "email_not_confirmed") {
          pendingConfirmation(email);
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
      else if (mode === "register") {
        const user =
          "user" in result.data ? (result.data.user as User | null) : null;
        if (signupNeedsSignIn(user)) {
          setPendingEmail(email);
          setStage("existing");
        } else if (
          !("session" in result.data && result.data.session) ||
          !user?.email_confirmed_at
        ) {
          pendingConfirmation(email);
          rememberSent(email);
        } else onComplete();
      } else onComplete();
    } catch {
      setError(tr("Could not connect. Check your connection and try again."));
    } finally {
      setBusy(false);
      setCaptchaToken("");
      setCaptchaReset((value) => value + 1);
    }
  };
  const returnToForm = (next: "login" | "register" | "reset") => {
    setEmail(pendingEmail);
    setMode(next);
    setStage("form");
    setShowResendChallenge(false);
    setCaptchaToken("");
    setCaptchaReset((value) => value + 1);
    setError("");
    setMessage("");
  };
  if (stage !== "form" && !recovering) {
    const existing = stage === "existing";
    return (
      <section className={styles.confirmation} aria-labelledby="auth-next-step">
        <span className={styles.symbol} aria-hidden="true">
          {existing ? <LogIn size={30} /> : <Mail size={30} />}
          {!existing && (
            <span className={styles.check}>
              <Check size={13} />
            </span>
          )}
        </span>
        <div className={styles.heading}>
          <p className="eyebrow">
            {tr(existing ? "Account access" : "One more step")}
          </p>
          <h2 id="auth-next-step" ref={heading} tabIndex={-1}>
            {tr(existing ? "Try signing in" : "Check your email")}
          </h2>
        </div>
        <p className={styles.email}>{pendingEmail}</p>
        <p className={styles.explanation}>
          {tr(
            existing
              ? "We can’t complete a new signup with this email. If you already have an account, sign in or reset your password."
              : "Open the verification link in your email, then come back and sign in. Check your spam folder too.",
          )}
        </p>
        {!existing && (
          <div className={styles.steps}>
            <span>
              <span>1</span>
              {tr("Verify your email")}
            </span>
            <span>
              <span>2</span>
              {tr("Sign in to your garage")}
            </span>
          </div>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <button
          type="button"
          className="primary-action"
          disabled={busy}
          onClick={() => returnToForm("login")}
        >
          {tr("Continue to sign in")}
          <ArrowRight size={17} />
        </button>
        {existing ? (
          <button
            type="button"
            className="text-link"
            onClick={() => returnToForm("reset")}
          >
            {tr("Reset password")}
          </button>
        ) : (
          <div className={styles.resend}>
            {showResendChallenge && captchaKey ? (
              <>
                <BotChallenge
                  siteKey={captchaKey}
                  onToken={setCaptchaToken}
                  resetKey={captchaReset}
                />
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || !captchaToken}
                  onClick={resend}
                >
                  {busy && <LoaderCircle className="spin" size={16} />}
                  {tr("Send another verification email")}
                </button>
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() => {
                    setShowResendChallenge(false);
                    setCaptchaToken("");
                  }}
                >
                  {tr("Cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="text-link"
                disabled={busy || remaining > 0}
                onClick={() => {
                  if (captchaKey) {
                    setCaptchaToken("");
                    setShowResendChallenge(true);
                  } else void resend();
                }}
              >
                {remaining > 0 ? (
                  <>
                    {tr("Resend available in")} {remaining}
                    {tr("s")}
                  </>
                ) : (
                  tr("Resend verification email")
                )}
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={() => returnToForm("register")}
        >
          {tr(existing ? "Use a different email" : "Change email")}
        </button>
        <p className={styles.footnote}>
          {tr(
            "Your garage stays private. Email verification is required to sign in.",
          )}
        </p>
      </section>
    );
  }
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
      <form
        className="stack"
        onSubmit={submit}
        key={recovering ? "recovery" : mode}
      >
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
              ref={emailInput}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
        {tr("Save your cars and view their city-reported ticket history.")}
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
