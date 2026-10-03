"use client";
import { useRef, useState } from "react";
import { MessageSquare, Send, LoaderCircle } from "lucide-react";
import { useAccount } from "./account-provider";
import { usePreferences } from "./preferences";
import CustomSelect from "./custom-select";
import { crmClientRequest } from "@/lib/crm-client";

export default function SupportFeedback({
  onSignIn,
}: {
  onSignIn: () => void;
}) {
  const { client, user } = useAccount();
  const { tr } = usePreferences();
  const [kind, setKind] = useState("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mountedRequest = useRef(0);
  return (
    <section className="glass form-card support-feedback">
      <div className="account-identity-heading">
        <span className="account-profile-mark">
          <MessageSquare size={20} />
        </span>
        <div>
          <h2>{tr("Support & feedback")}</h2>
          <span>{tr("A question, an idea, or something to fix")}</span>
        </div>
      </div>
      <p className="small muted">
        {tr(
          "Send a message to our private support inbox. Messages are kept for up to 90 days.",
        )}
      </p>
      {!user ? (
        <button className="button" onClick={onSignIn}>
          {tr("Sign in to contact support")}
        </button>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!client || busy) return;
            const request = ++mountedRequest.current;
            setBusy(true);
            setError("");
            setNotice("");
            try {
              await crmClientRequest(client, "support_create", {
                kind,
                subject: subject.trim(),
                message: message.trim(),
                expectedUserId: user.id,
              });
              if (request === mountedRequest.current) {
                setSubject("");
                setMessage("");
                setNotice("Message sent to support.");
              }
            } catch (err) {
              if (request === mountedRequest.current)
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not send your message. Please try again.",
                );
            } finally {
              if (request === mountedRequest.current) setBusy(false);
            }
          }}
        >
          <label className="stack small">
            {tr("Message type")}
            <CustomSelect
              label="Message type"
              value={kind}
              onChange={setKind}
              options={[
                { value: "support", label: "Support question" },
                { value: "feedback", label: "Product feedback" },
                { value: "bug", label: "Report a problem" },
              ]}
            />
          </label>
          <label className="stack small">
            {tr("Subject")}
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={160}
              required
              disabled={busy}
            />
          </label>
          <label className="stack small">
            {tr("Your message")}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              rows={4}
              required
              disabled={busy}
            />
          </label>
          <p className="small muted">
            {tr(
              "Do not include passwords, verification codes, or payment details.",
            )}
          </p>
          {error && (
            <p className="error small" role="alert">
              {tr(error)}
            </p>
          )}
          {notice && (
            <p className="small" role="status">
              {tr(notice)}
            </p>
          )}
          <button
            className="button primary"
            disabled={busy || !subject.trim() || !message.trim()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Send size={16} />
            )}{" "}
            {tr("Send message")}
          </button>
        </form>
      )}
    </section>
  );
}
