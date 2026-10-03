"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Link2Off, LoaderCircle } from "lucide-react";
import { useSupabaseAccount } from "./use-supabase-account";
import { usePreferences } from "./preferences";
import {
  confirmationOutcome,
  notifyEmailConfirmed,
  parseConfirmationCallback,
  readConfirmationEvidence,
} from "../lib/email-confirmation";
import styles from "./email-confirmation.module.css";

export default function EmailConfirmation() {
  const account = useSupabaseAccount();
  const { tr, locale } = usePreferences();
  const [callback, setCallback] = useState(() => {
    const current = parseConfirmationCallback(
      typeof window === "undefined"
        ? "https://ticketsafe.invalid/auth/confirm"
        : window.location.href,
    );
    const captured = account.emailConfirmationCallback;
    return captured && captured.requestId === current.requestId
      ? captured
      : current;
  });
  const [outcome, setOutcome] = useState<
    "checking" | "verified" | "already" | "unavailable"
  >("checking");

  useEffect(() => {
    const update = () => {
      const current = parseConfirmationCallback(window.location.href);
      // Ignore Auth's removal of consumed tokens, but handle a reused link
      // that navigates this same document to a new error fragment.
      if (
        current.errorCode ||
        current.hasCredentials ||
        current.requestId !== callback.requestId
      ) {
        setCallback(current);
      }
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, [callback.requestId]);

  useEffect(() => {
    if (account.loading) return;
    let alive = true;
    // Run after Auth's callback initialization has settled. Never trust URL
    // tokens or local confirmation receipts as proof of a signed-in account.
    void Promise.resolve().then(() => {
      if (!alive) return;
      const evidence = readConfirmationEvidence();
      const result = confirmationOutcome(
        callback,
        account.user,
        evidence.pending,
        evidence.receipt,
      );
      setOutcome(result);
      if (result === "verified" && account.user)
        notifyEmailConfirmed(callback.requestId, account.user.id);
      // Remove tokens/errors from browser history without a navigation.
      if (window.location.hash || window.location.search.includes("code=")) {
        const clean = new URL(window.location.href);
        clean.hash = "";
        clean.searchParams.delete("code");
        window.history.replaceState(
          window.history.state,
          "",
          clean.pathname + clean.search,
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [account.loading, account.user, callback]);

  const success = outcome === "verified" || outcome === "already";
  const heading =
    outcome === "checking"
      ? "Verifying your email…"
      : outcome === "verified"
        ? "Email verified"
        : outcome === "already"
          ? "Email already verified"
          : "This link is unavailable";
  return (
    <main className={styles.shell}>
      <section
        className={styles.card}
        aria-labelledby="confirmation-title"
        aria-busy={outcome === "checking"}
      >
        <Link className={styles.brand} href="/">
          {locale === "zh" ? "罚单卫士" : "TicketSafe"}
          <span>.</span>
        </Link>
        <span className={styles.symbol} aria-hidden="true">
          {outcome === "checking" ? (
            <LoaderCircle size={32} className="spin" />
          ) : success ? (
            <CheckCircle2 size={32} />
          ) : (
            <Link2Off size={32} />
          )}
        </span>
        <h1 id="confirmation-title">{tr(heading)}</h1>
        <p role="status">
          {tr(
            outcome === "checking"
              ? "Just a moment."
              : success
                ? "You’re ready to use TicketSafe. You can return to your original tab."
                : "The link may have expired or already been used. Try signing in, or request a new verification email.",
          )}
        </p>
        {outcome !== "checking" && (
          <Link
            className="button primary"
            href={
              success
                ? "/?auth=confirmed&view=account"
                : "/?auth=login&view=account"
            }
          >
            {tr(success ? "Continue to TicketSafe" : "Continue to sign in")}
            <ArrowRight size={17} />
          </Link>
        )}
      </section>
    </main>
  );
}
