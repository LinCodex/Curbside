"use client";
import { useState } from "react";
import {
  ArrowRight,
  KeyRound,
  Mail,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { useAccount } from "./account-provider";
import { usePreferences } from "./preferences";
import { requestEmailChange } from "@/lib/account-details";

export default function AccountDetails({
  onResetPassword,
  onDeleteAccount,
}: {
  onResetPassword: () => void;
  onDeleteAccount: () => void;
}) {
  const { client, user } = useAccount();
  const { tr } = usePreferences();
  const [newEmail, setNewEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState(user?.new_email || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (!client || !user)
    return (
      <p role="status">
        {tr("Please sign in again before editing account details.")}
      </p>
    );
  return (
    <div className="account-details-panel">
      <p className="small muted">
        {tr(
          "Manage how you sign in. Your saved cars and preferences stay with your account.",
        )}
      </p>
      <section className="account-detail-section">
        <div className="account-detail-heading">
          <Mail size={18} />
          <h3>{tr("Email address")}</h3>
          <span className="badge">
            <ShieldCheck size={12} />
            {tr("Verified")}
          </span>
        </div>
        <p className="account-detail-value">{user.email}</p>
        {!!pendingEmail && (
          <p className="notice" role="status">
            {tr("Awaiting confirmation:")} {pendingEmail}
            <br />
            {tr(
              "Check your current and new inboxes, including spam. Follow the confirmation links to finish the change.",
            )}
          </p>
        )}
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const updated = await requestEmailChange(
                client,
                user.id,
                newEmail,
                window.location.origin,
              );
              const pending =
                updated.new_email ||
                (updated.email !== newEmail.trim().toLowerCase()
                  ? newEmail.trim()
                  : "");
              setPendingEmail(pending);
              setMessage(
                tr(
                  pending
                    ? "Confirmation requested. Check your current and new inboxes, including spam. Your existing email remains active until the change is confirmed."
                    : "Email address updated.",
                ),
              );
              setNewEmail("");
            } catch (failure) {
              const code = (failure as { code?: string }).code;
              setError(
                tr(
                  code?.includes("rate_limit")
                    ? "Too many attempts. Please wait before trying again."
                    : code === "email_exists"
                      ? "This email address cannot be used. Choose another address."
                      : code
                        ? "Could not update your email. Please try again later."
                        : (failure as Error).message,
                ),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            {tr("New email address")}
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            className="button primary"
            disabled={
              busy ||
              !newEmail.trim() ||
              newEmail.trim().toLowerCase() === user.email?.toLowerCase()
            }
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <ArrowRight size={16} />
            )}
            {tr("Change email")}
          </button>
        </form>
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
        <div className="account-detail-unavailable">
          <button className="button ghost" disabled>
            {tr("Remove email")}
          </button>
          <p className="small muted">
            {tr(
              "An email address is required while email is your only sign-in method. Replace it above instead of removing it.",
            )}
          </p>
        </div>
      </section>
      <section className="account-detail-section">
        <div className="account-detail-heading">
          <KeyRound size={18} />
          <h3>{tr("Password")}</h3>
        </div>
        <p className="small muted">
          {tr(
            "Reset your password through a secure link sent to your verified email. Check your inbox and spam folder.",
          )}
        </p>
        <button className="button" onClick={onResetPassword} disabled={busy}>
          <Mail size={16} />
          {tr("Reset password")}
        </button>
      </section>
      <button
        className="text-link account-delete-link"
        onClick={onDeleteAccount}
        disabled={busy}
      >
        {tr("Delete account")}
      </button>
    </div>
  );
}
