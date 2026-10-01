"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePreferences } from "./preferences";
import { Check, ShieldCheck } from "lucide-react";
type CaptchaSDK = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    hcaptcha?: CaptchaSDK;
  }
}
let loading: Promise<CaptchaSDK> | null = null;
function loadSDK() {
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha);
  if (loading) return loading;
  loading = new Promise<CaptchaSDK>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    const timer = setTimeout(() => {
      loading = null;
      script.remove();
      reject(new Error("timeout"));
    }, 15000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.hcaptcha) resolve(window.hcaptcha);
      else {
        loading = null;
        reject(new Error("unavailable"));
      }
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
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey?: number;
}) {
  const { tr, locale, resolvedTheme } = usePreferences();
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ sdk: CaptchaSDK; id: string } | null>(null);
  const callback = useRef(onToken);
  useLayoutEffect(() => {
    callback.current = onToken;
  }, [onToken]);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  const [verified, setVerified] = useState(false);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState<"normal" | "compact" | null>(null);
  useLayoutEffect(() => {
    if (!container.current) return;
    const measure = () =>
      setSize(container.current!.clientWidth >= 304 ? "normal" : "compact");
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!size) return;
    let alive = true;
    callback.current("");
    loadSDK()
      .then((sdk) => {
        if (!alive || !container.current) return;
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
      })
      .catch(() => {
        if (alive) setFailure(true);
      });
    return () => {
      alive = false;
      if (widget.current) widget.current.sdk.remove(widget.current.id);
      widget.current = null;
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
    <div className="bot-challenge" data-verified={verified}>
      <div className="bot-challenge-heading">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>{tr("Security check")}</span>
        <small role="status">
          {verified && <Check size={12} aria-hidden="true" />}
          {tr(verified ? "Verified" : "Required")}
        </small>
      </div>
      <div className="bot-challenge-widget" data-size={size} ref={container} />
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
