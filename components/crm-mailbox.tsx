"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  Mail,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Archive,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  crmClientRequest,
  type CrmThread,
  type CrmThreadMessage,
  type CrmThreads,
} from "@/lib/crm-client";
import { splitQuoted } from "@/lib/crm-inbound";

type Translate = (text: string) => string;
const FOLDERS = [
  { id: "needs_reply", label: "Needs reply" },
  { id: "unread", label: "Unread" },
  { id: "all", label: "All mail" },
  { id: "closed", label: "Closed" },
] as const;
type Folder = (typeof FOLDERS)[number]["id"];
const KIND_LABELS = {
  support: "Support",
  feedback: "Feedback",
  bug: "Problem",
  email: "Email",
} as const;
const draftKey = (threadId: string) => `ticketsafe.crm-reply.${threadId}`;

function readDraft(threadId: string) {
  try {
    return sessionStorage.getItem(draftKey(threadId)) || "";
  } catch {
    return "";
  }
}
function writeDraft(threadId: string, text: string) {
  try {
    if (text) sessionStorage.setItem(draftKey(threadId), text);
    else sessionStorage.removeItem(draftKey(threadId));
  } catch {
    /* Drafts are a convenience; sending still works without storage. */
  }
}

function listTime(value: string, locale: string) {
  const date = new Date(value);
  const today = new Date();
  return new Intl.DateTimeFormat(
    locale,
    date.toDateString() === today.toDateString()
      ? { hour: "numeric", minute: "2-digit" }
      : date.getFullYear() === today.getFullYear()
        ? { month: "short", day: "numeric" }
        : { year: "numeric", month: "short", day: "numeric" },
  ).format(date);
}
const fullTime = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function Avatar({ label, outbound }: { label: string; outbound?: boolean }) {
  return (
    <span
      className={outbound ? "crm-mail-avatar outbound" : "crm-mail-avatar"}
      aria-hidden="true"
    >
      {(label.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

function MessageCard({
  message,
  customer,
  locale,
  tr,
  retrying,
  onRetry,
}: {
  message: CrmThreadMessage;
  customer: string;
  locale: string;
  tr: Translate;
  retrying: boolean;
  onRetry: () => void;
}) {
  const [showQuoted, setShowQuoted] = useState(false);
  const outbound = message.direction === "outbound";
  const { body, quoted } = outbound
    ? { body: message.body, quoted: "" }
    : splitQuoted(message.body);
  const sender = outbound
    ? tr("TicketSafe Support")
    : message.from_name || message.from_email || customer;
  return (
    <article className={outbound ? "crm-mail-message outbound" : "crm-mail-message"}>
      <header>
        <Avatar label={sender} outbound={outbound} />
        <div className="crm-mail-message-from">
          <strong>{sender}</strong>
          <span>
            {outbound
              ? message.actor_email
                ? `${tr("Sent by")} ${message.actor_email}`
                : tr("Reply")
              : message.from_name
                ? message.from_email
                : message.source === "app"
                  ? tr("Sent from the app")
                  : tr("Email reply")}
          </span>
        </div>
        <time dateTime={message.created_at}>
          {fullTime(message.created_at, locale)}
        </time>
      </header>
      <div className="crm-mail-body">{body || message.body}</div>
      {quoted && (
        <>
          <button
            type="button"
            className="crm-mail-quoted-toggle"
            onClick={() => setShowQuoted((value) => !value)}
            aria-expanded={showQuoted}
            aria-label={tr(showQuoted ? "Hide quoted text" : "Show quoted text")}
            title={tr(showQuoted ? "Hide quoted text" : "Show quoted text")}
          >
            <MoreHorizontal size={16} />
          </button>
          {showQuoted && <div className="crm-mail-body crm-mail-quoted">{quoted}</div>}
        </>
      )}
      {message.attachments.length > 0 && (
        <ul className="crm-mail-attachments">
          {message.attachments.map((file, index) => (
            <li key={index}>
              <Paperclip size={14} aria-hidden="true" />
              {file.filename}
            </li>
          ))}
          <li className="crm-mail-attachment-note">
            {tr("Attachments stay in Resend and are not stored here.")}
          </li>
        </ul>
      )}
      {outbound && message.status !== "sent" && (
        <div className="crm-mail-delivery">
          {message.needs_review ? (
            <>
              <span className="crm-tag crm-tag-error">
                {tr("Delivery not confirmed")}
              </span>
              {message.retryable && (
                <button
                  type="button"
                  className="crm-button"
                  onClick={onRetry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <LoaderCircle size={15} className="crm-spinner" />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                  {tr("Retry send")}
                </button>
              )}
            </>
          ) : (
            <span className="crm-tag">{tr("Sending…")}</span>
          )}
        </div>
      )}
    </article>
  );
}

export function CrmMailbox({
  client,
  tr,
  locale,
  canDelete,
}: {
  client: SupabaseClient;
  tr: Translate;
  locale: string;
  canDelete: boolean;
}) {
  const [folder, setFolder] = useState<Folder>("needs_reply");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<CrmThreads | null>(null);
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [listRevision, setListRevision] = useState(0);
  const [selected, setSelected] = useState("");
  const [thread, setThread] = useState<CrmThread | null>(null);
  const [threadError, setThreadError] = useState("");
  const [threadRevision, setThreadRevision] = useState(0);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sendKey = useRef<{ text: string; key: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    crmClientRequest<CrmThreads>(client, "threads", { filter: folder, search, page })
      .then((result) => {
        if (!active) return;
        setList(result);
        setListError("");
      })
      .catch((error) => {
        if (active)
          setListError(
            error instanceof Error ? error.message : "CRM unavailable. Please try again.",
          );
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, folder, search, page, listRevision]);

  const refreshList = useCallback(() => {
    setListLoading(true);
    setListRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refreshList();
    }, 60_000);
    return () => clearInterval(timer);
  }, [refreshList]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    crmClientRequest<CrmThread>(client, "thread", { threadId: selected })
      .then((result) => {
        if (!active) return;
        setThread(result);
        setThreadError("");
        setList((current) =>
          current
            ? {
                ...current,
                threads: current.threads.map((item) =>
                  item.id === selected ? { ...item, unread: false } : item,
                ),
              }
            : current,
        );
      })
      .catch((error) => {
        if (active)
          setThreadError(
            error instanceof Error ? error.message : "CRM unavailable. Please try again.",
          );
      });
    return () => {
      active = false;
    };
  }, [client, selected, threadRevision]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  const open = (id: string) => {
    if (id === selected) return;
    setSelected(id);
    setThread(null);
    setThreadError("");
    setSendError("");
    setConfirmDelete(false);
    setReply(readDraft(id));
    sendKey.current = null;
  };
  const close = () => {
    setSelected("");
    setThread(null);
  };
  const changeFolder = (next: Folder) => {
    setFolder(next);
    setPage(1);
    setListLoading(true);
  };

  const send = async (retryMessageId?: string) => {
    if (!thread || sending) return;
    const text = reply.trim();
    if (!retryMessageId && !text) return;
    if (!retryMessageId && sendKey.current?.text !== text)
      sendKey.current = { text, key: crypto.randomUUID() };
    setSending(true);
    setSendError("");
    try {
      await crmClientRequest(
        client,
        "thread_reply",
        retryMessageId
          ? { threadId: thread.thread.id, retryMessageId }
          : {
              threadId: thread.thread.id,
              reply: text,
              idempotencyKey: sendKey.current!.key,
            },
      );
      if (!retryMessageId) {
        setReply("");
        writeDraft(thread.thread.id, "");
        sendKey.current = null;
      }
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "The reply email was not accepted. Try again.",
      );
    } finally {
      setSending(false);
      setThreadRevision((value) => value + 1);
      refreshList();
    }
  };

  const setStatus = async (status: "open" | "closed") => {
    if (!thread) return;
    setBusy(status);
    try {
      await crmClientRequest(client, "thread_status", {
        threadId: thread.thread.id,
        status,
      });
      setThreadRevision((value) => value + 1);
      refreshList();
    } catch (error) {
      setThreadError(
        error instanceof Error ? error.message : "CRM unavailable. Please try again.",
      );
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    if (!thread) return;
    setBusy("delete");
    try {
      await crmClientRequest(client, "thread_delete", { threadId: thread.thread.id });
      writeDraft(thread.thread.id, "");
      close();
      refreshList();
    } catch (error) {
      setThreadError(
        error instanceof Error ? error.message : "CRM unavailable. Please try again.",
      );
    } finally {
      setBusy("");
      setConfirmDelete(false);
    }
  };

  const counts: Partial<Record<Folder, number>> = {
    needs_reply: list?.needsReply,
    unread: list?.unread,
  };
  const first = list && list.total ? (list.page - 1) * list.pageSize + 1 : 0;
  const last = list ? Math.min(list.total, list.page * list.pageSize) : 0;

  return (
    <section className={selected ? "crm-mail reading" : "crm-mail"}>
      <div className="crm-page-heading">
        <div>
          <h1>{tr("Inbox")}</h1>
          <p>
            {tr(
              "Support messages from the app and customer replies to TicketSafe emails, as conversations. Conversations expire 90 days after their last message.",
            )}
          </p>
        </div>
      </div>
      {list && !list.receiving && (
        <p className="crm-feedback crm-mail-setup" role="note">
          <Mail size={16} />
          {tr(
            "Email replies are not connected yet. In-app messages appear here now; customer email replies will appear once receiving is set up in Resend.",
          )}
        </p>
      )}
      <div className="crm-mail-layout">
        <div className="crm-mail-list-pane">
          <form
            className="crm-mail-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const next = searchDraft.trim();
              if (next === search) return;
              setSearch(next);
              setPage(1);
              setListLoading(true);
            }}
          >
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              maxLength={100}
              placeholder={tr("Search mail")}
              aria-label={tr("Search mail")}
            />
          </form>
          <div className="crm-mail-toolbar">
            <div className="crm-mail-folders" role="tablist" aria-label={tr("Folders")}>
              {FOLDERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={folder === id}
                  className={folder === id ? "active" : undefined}
                  onClick={() => changeFolder(id)}
                >
                  {tr(label)}
                  {!!counts[id] && <span className="crm-mail-count">{counts[id]}</span>}
                </button>
              ))}
            </div>
            <div className="crm-mail-pager">
              <span>
                {first}–{last} {tr("of")} {list?.total ?? 0}
              </span>
              <button
                type="button"
                className="crm-mail-icon"
                onClick={() => {
                  setPage(page - 1);
                  setListLoading(true);
                }}
                disabled={page <= 1 || listLoading}
                aria-label={tr("Newer")}
                title={tr("Newer")}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                className="crm-mail-icon"
                onClick={() => {
                  setPage(page + 1);
                  setListLoading(true);
                }}
                disabled={!list || last >= list.total || listLoading}
                aria-label={tr("Older")}
                title={tr("Older")}
              >
                <ChevronRight size={17} />
              </button>
              <button
                type="button"
                className="crm-mail-icon"
                onClick={refreshList}
                disabled={listLoading}
                aria-label={tr("Refresh")}
                title={tr("Refresh")}
              >
                <RefreshCw size={16} className={listLoading ? "crm-spinner" : undefined} />
              </button>
            </div>
          </div>
          {listError && (
            <p className="crm-error crm-feedback" role="alert">
              {tr(listError)}
            </p>
          )}
          <ul className="crm-mail-list" aria-label={tr("Conversations")} aria-busy={listLoading}>
            {list?.threads.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={[
                    "crm-mail-row",
                    item.unread ? "unread" : "",
                    item.id === selected ? "selected" : "",
                  ].join(" ")}
                  onClick={() => open(item.id)}
                  aria-current={item.id === selected ? "true" : undefined}
                >
                  <Avatar label={item.customer_name || item.customer_email} />
                  <span className="crm-mail-row-main">
                    <span className="crm-mail-row-top">
                      <span className="crm-mail-sender">
                        {item.customer_name || item.customer_email}
                        {item.message_count > 1 && (
                          <span className="crm-mail-thread-count">{item.message_count}</span>
                        )}
                      </span>
                      <time dateTime={item.last_message_at}>
                        {listTime(item.last_message_at, locale)}
                      </time>
                    </span>
                    <span className="crm-mail-subject">{item.subject}</span>
                    <span className="crm-mail-snippet">
                      {item.last?.direction === "outbound" && `${tr("You")}: `}
                      {item.last?.body}
                    </span>
                    <span className="crm-mail-row-tags">
                      <span className="crm-tag">{tr(KIND_LABELS[item.kind])}</span>
                      {item.status === "open" && (
                        <span className="crm-tag crm-tag-open">{tr("Needs a reply")}</span>
                      )}
                      {item.status === "closed" && (
                        <span className="crm-tag">{tr("Closed")}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {list && !list.threads.length && !listLoading && (
            <div className="crm-empty">
              <Inbox size={28} />
              <p>{tr(search ? "No conversations match your search." : "Nothing here. You're all caught up.")}</p>
            </div>
          )}
        </div>
        <div className="crm-mail-reader">
          {!selected ? (
            <div className="crm-empty crm-mail-placeholder">
              <Mail size={30} />
              <p>{tr("Select a conversation to read it.")}</p>
            </div>
          ) : !thread ? (
            threadError ? (
              <p className="crm-error crm-feedback" role="alert">
                {tr(threadError)}
              </p>
            ) : (
              <p className="crm-feedback" role="status">
                <LoaderCircle size={16} className="crm-spinner" />
                {tr("Loading…")}
              </p>
            )
          ) : (
            <>
              <div className="crm-mail-reader-head">
                <button
                  type="button"
                  className="crm-mail-icon crm-mail-back"
                  onClick={close}
                  aria-label={tr("Back to inbox")}
                  title={tr("Back to inbox")}
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="crm-mail-reader-title">
                  <h2>{thread.thread.subject}</h2>
                  <span>
                    {thread.thread.customer_name
                      ? `${thread.thread.customer_name} · ${thread.thread.customer_email}`
                      : thread.thread.customer_email}
                    {" · "}
                    {tr(KIND_LABELS[thread.thread.kind])}
                    {!thread.thread.user_id && ` · ${tr("No TicketSafe account")}`}
                  </span>
                </div>
                <div className="crm-mail-reader-actions">
                  {thread.thread.status === "closed" ? (
                    <button
                      type="button"
                      className="crm-mail-icon"
                      onClick={() => void setStatus("open")}
                      disabled={!!busy}
                      aria-label={tr("Reopen")}
                      title={tr("Reopen")}
                    >
                      <RotateCcw size={17} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="crm-mail-icon"
                      onClick={() => void setStatus("closed")}
                      disabled={!!busy}
                      aria-label={tr("Close conversation")}
                      title={tr("Close conversation")}
                    >
                      <Archive size={17} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="crm-mail-icon"
                      onClick={() => setConfirmDelete(true)}
                      disabled={!!busy}
                      aria-label={tr("Delete conversation")}
                      title={tr("Delete conversation")}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              </div>
              {confirmDelete && (
                <div className="crm-feedback crm-mail-confirm" role="alertdialog">
                  <span>{tr("Delete this whole conversation? This can't be undone.")}</span>
                  <button
                    type="button"
                    className="crm-button crm-danger"
                    onClick={() => void remove()}
                    disabled={busy === "delete"}
                  >
                    {tr("Delete")}
                  </button>
                  <button
                    type="button"
                    className="crm-button"
                    onClick={() => setConfirmDelete(false)}
                  >
                    {tr("Cancel")}
                  </button>
                </div>
              )}
              {threadError && (
                <p className="crm-error crm-feedback" role="alert">
                  {tr(threadError)}
                </p>
              )}
              <div className="crm-mail-messages">
                {thread.messages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    customer={thread.thread.customer_email}
                    locale={locale}
                    tr={tr}
                    retrying={sending}
                    onRetry={() => void send(message.id)}
                  />
                ))}
                <div ref={bottom} />
              </div>
              <form
                className="crm-mail-compose"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <label htmlFor="crm-mail-reply">
                  {tr("Reply to")} {thread.thread.customer_email}
                </label>
                <textarea
                  id="crm-mail-reply"
                  value={reply}
                  maxLength={10000}
                  rows={5}
                  placeholder={tr("Write your reply…")}
                  onChange={(event) => {
                    setReply(event.target.value);
                    writeDraft(thread.thread.id, event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                {sendError && (
                  <p className="crm-error" role="alert">
                    {tr(sendError)}
                  </p>
                )}
                <div className="crm-mail-compose-actions">
                  <span className="crm-mail-hint">
                    {tr("Sent from support@ezrefillny.net. Ctrl+Enter to send.")}
                  </span>
                  <button
                    type="submit"
                    className="crm-button crm-primary"
                    disabled={sending || !reply.trim()}
                  >
                    {sending ? (
                      <LoaderCircle size={16} className="crm-spinner" />
                    ) : (
                      <Send size={16} />
                    )}
                    {tr("Send")}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
