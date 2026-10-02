"use client";
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { usePreferences } from "./preferences";
import { Check, ShieldCheck } from "lucide-react";
type CaptchaSDK = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
  execute(id: string, options: { async: true }): Promise<{ response: string }>;
};
export type ChallengeHandle = { execute(): Promise<string> };
type Widget = { sdk: CaptchaSDK; id: string };
declare global {
  interface Window {
    hcaptcha?: CaptchaSDK;
    ticketSafeHCaptchaReady?: () => void;
  }
}
let loading: Promise<CaptchaSDK> | null = null;
function loadSDK() {
  if (loading) return loading;
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha);
  loading = new Promise<CaptchaSDK>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://js.hcaptcha.com/1/api.js?render=explicit&onload=ticketSafeHCaptchaReady";
    script.async = true;
    script.defer = true;
    const timer = setTimeout(() => {
      loading = null;
      script.remove();
      reject(new Error("timeout"));
    }, 15000);
    window.ticketSafeHCaptchaReady = () => {
      clearTimeout(timer);
      if (window.hcaptcha) resolve(window.hcaptcha);
      else {
        loading = null;
        reject(new Error("unavailable"));
      }
      delete window.ticketSafeHCaptchaReady;
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      loading = null;
      reject(new Error("unavailable"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
export default function BotChallenge({
  siteKey,
  onToken,
  resetKey = 0,
  mode = "visible",
  verifiedUntil = null,
  ref,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey?: number;
  mode?: "visible" | "invisible";
  verifiedUntil?: number | null;
  ref?: Ref<ChallengeHandle>;
}) {
  const { tr, locale, resolvedTheme } = usePreferences();
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<Widget | null>(null);
  const initialization = useRef<Promise<Widget> | null>(null);
  const inFlight = useRef(false);
  const callback = useRef(onToken);
  useLayoutEffect(() => {
    callback.current = onToken;
  }, [onToken]);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  const [verified, setVerified] = useState(false);
  const [ready, setReady] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [visibleSize, setSize] = useState<"normal" | "compact" | null>(null);
  const size = mode === "invisible" ? "invisible" : visibleSize;
  useLayoutEffect(() => {
    if (mode === "invisible") {
      return;
    }
    if (!container.current) return;
    const measure = () =>
      setSize(container.current!.clientWidth >= 304 ? "normal" : "compact");
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [mode]);
  useImperativeHandle(
    ref,
    () => ({
      async execute() {
        if (!initialization.current)
          throw new Error(
            tr("Security check is loading. Please try again shortly."),
          );
        if (inFlight.current)
          throw new Error(tr("Security check is already in progress."));
        inFlight.current = true;
        setExecuting(true);
        try {
          const active = await initialization.current;
          if (active !== widget.current)
            throw new Error("Security check was closed");
          active.sdk.reset(active.id);
          callback.current("");
          const result = await active.sdk.execute(active.id, { async: true });
          if (active !== widget.current)
            throw new Error("Security check was closed");
          if (!result.response) throw new Error("Missing verification token");
          return result.response;
        } catch {
          throw new Error(
            tr(
              "Security check could not complete. Please try searching again.",
            ),
          );
        } finally {
          inFlight.current = false;
          setExecuting(false);
        }
      },
    }),
    [tr],
  );
  useEffect(() => {
    if (!size) return;
    let alive = true;
    callback.current("");
    initialization.current = Promise.resolve()
      .then(() => {
        if (alive) {
          setReady(false);
          setVerified(false);
        }
        return loadSDK();
      })
      .then((sdk) => {
        if (!alive || !container.current)
          throw new Error("Security check was closed");
        setVerified(false);
        setFailure(false);
        widget.current = {
          sdk,
          id: sdk.render(container.current, {
            sitekey: siteKey,
            theme: resolvedTheme,
            hl: locale === "zh" ? "zh-CN" : "en",
            size,
            callback: (token: string) => {
              if (!alive) return;
              setVerified(!!token);
              setFailure(false);
              callback.current(token);
            },
            "expired-callback": () => {
              if (!alive) return;
              setVerified(false);
              callback.current("");
            },
            "error-callback": () => {
              if (!alive) return;
              setVerified(false);
              callback.current("");
              setFailure(true);
            },
          }),
        };
        setReady(true);
        return widget.current;
      })
      .catch((error) => {
        if (alive) setFailure(true);
        throw error;
      });
    void initialization.current.catch(() => {});
    return () => {
      alive = false;
      if (widget.current) widget.current.sdk.remove(widget.current.id);
      widget.current = null;
      initialization.current = null;
      callback.current("");
    };
  }, [siteKey, locale, resolvedTheme, retry, size]);
  useEffect(() => {
    if (widget.current) {
      widget.current.sdk.reset(widget.current.id);
      setVerified(false);
      callback.current("");
    }
  }, [resetKey]);
  return (
    <div
      className="bot-challenge"
      data-mode={mode}
      data-verified={verified || !!verifiedUntil}
    >
      <div className="bot-challenge-heading">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>
          {tr(
            mode === "invisible"
              ? "Automatic security check"
              : "Security check",
          )}
        </span>
        <small role="status">
          {(verified || verifiedUntil) && (
            <Check size={12} aria-hidden="true" />
          )}
          {tr(
            executing
              ? "Verifying…"
              : verifiedUntil
                ? "Ready"
                : verified
                  ? "Verified"
                  : mode === "invisible"
                    ? "On search"
                    : "Required",
          )}
        </small>
      </div>
      <div className="bot-challenge-widget" data-size={size} ref={container} />
      {mode === "invisible" && (
        <p className="security-disclosure">
          {tr(
            verifiedUntil
              ? "Recent verification is valid. Protection stays active for every search."
              : "Runs when you search. A challenge appears only when required.",
          )}
          <span>
            {tr("Protected by hCaptcha.")}{" "}
            <a
              href="https://www.hcaptcha.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              {tr("Privacy")}
            </a>
            {" · "}
            <a
              href="https://www.hcaptcha.com/terms"
              target="_blank"
              rel="noreferrer"
            >
              {tr("Terms")}
            </a>
          </span>
        </p>
      )}
      {!ready && !failure && (
        <p className="bot-challenge-loading" role="status">
          {tr("Loading security check…")}
        </p>
      )}
      {failure && (
        <div className="notice warning" role="alert">
          {tr(
            "Security check could not load. Check your connection or content blocker.",
          )}
          <button
            className="text-link"
            type="button"
            onClick={() => {
              setFailure(false);
              setRetry(retry + 1);
            }}
          >
            {tr("Try again")}
          </button>
        </div>
      )}
    </div>
  );
}
