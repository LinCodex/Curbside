"use client";
import { useRef, useState } from "react";
import {
  ChevronRight,
  CircleCheck,
  MessageSquare,
  Send,
  LoaderCircle,
} from "lucide-react";
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
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const mountedRequest = useRef(0);
  return (
    <details className="glass form-card support-feedback">
      <summary>
        <span className="account-profile-mark">
          <MessageSquare size={20} />
        </span>
        <span className="account-identity-heading">
          <div>
            <h2>{tr("Support & feedback")}</h2>
            <span>{tr("A question, an idea, or something to fix")}</span>
          </div>
        </span>
        <ChevronRight className="support-disclosure-icon" size={18} />
      </summary>
      <div className="support-feedback-body">
      <p className="small muted">
        {tr(
          "Send a message to our private support inbox. Messages are kept for up to 90 days.",
        )}
      </p>
      {!user ? (
        <button className="button" type="button" onClick={onSignIn}>
          {tr("Sign in to contact support")}
        </button>
      ) : sent ? (
        <div className="support-sent" role="status">
          <span className="support-sent-mark">
            <CircleCheck size={22} />
          </span>
          <h3>{tr("Message sent")}</h3>
          <p>
            {tr(
              "We received your message. If we need anything else, we will email you.",
            )}
          </p>
          <button
            className="button"
            type="button"
            onClick={() => setSent(false)}
          >
            {tr("Send another message")}
          </button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!client || busy) return;
            const request = ++mountedRequest.current;
            setBusy(true);
            setError("");
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
                setSent(true);
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
      </div>
    </details>
  );
}
