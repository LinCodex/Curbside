"use client";
import { usePreferences, PreferencesPanel } from "./preferences";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CarFront,
  Search,
  Map as MapIcon,
  SlidersHorizontal,
  Plus,
  ChevronRight,
  ArrowUpRight,
  MapPin,
  ShieldCheck,
  Ticket,
  Info,
  ArrowRight,
  X,
  Check,
  Download,
  LogIn,
  FileText,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  RefreshCw,
  Navigation,
  LockKeyhole,
  CheckCircle2,
  Accessibility,
  LogOut,
  Edit3,
  UserRound,
  Clock3,
} from "lucide-react";
import { CityBackdrop } from "./city-backdrop";
import { TicketLocation } from "./ticket-location";
import { PlateBalance } from "./plate-balance";
import CustomSelect from "./custom-select";
import { useMapLocations } from "./use-map-locations";
import {
  hasPoint,
  contextRadius,
  cleanLocationLabel,
} from "@/lib/map-locations";
import { InstallGuide, PullToRefresh } from "./mobile-web-app";
import { PLATE_TYPES } from "@/lib/plate-types";
import { FREE_ACCESS } from "@/lib/release";
import { LEGAL_VERSION } from "@/lib/legal";
import { useAccount } from "./account-provider";
import AuthPanel from "./auth-panel";
import AccountDetails from "./account-details";
import { combinedGarageHistory } from "@/lib/garage-history";
import WelcomeOnboarding from "./welcome-onboarding";
import BotChallenge, { type ChallengeHandle } from "./bot-challenge";
import { NotificationSettings } from "./notification-settings";
import { hasOnboarded, onboardingCookie } from "@/lib/onboarding";
import {
  money,
  STATES,
  type Violation,
  type SearchResult,
  normalizePlate,
} from "@/lib/domain";
const CityMap = lazy(() => import("./city-map"));
const nav = [
  { id: "garage", label: "Garage", icon: CarFront },
  { id: "search", label: "Search", icon: Search },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "account", label: "Account", icon: UserRound },
];
const niceDate = (s?: string | null, locale = "en") =>
  s
    ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString(
        locale === "zh" ? "zh-CN" : "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : locale === "zh"
      ? "未提供"
      : "Not provided";
export default function Curbside() {
  const { tr, locale, detailMode } = usePreferences();
  const auth = useAccount();
  const config = auth.configuration;
  const [view, setView] = useState("garage"),
    [account, setAccount] = useState<any>(null),
    [results, setResults] = useState<SearchResult | null>(null),
    [selected, setSelected] = useState<any>(null),
    [sheet, setSheet] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [plate, setPlate] = useState(""),
    [state, setState] = useState("NY"),
    [plateType, setPlateType] = useState(""),
    [history, setHistory] = useState(true),
    [filter, setFilter] = useState("all"),
    [offline, setOffline] = useState(false),
    [vehicleId, setVehicleId] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [mapSelection, setMapSelection] = useState("");
  const [mapVehicleId, setMapVehicleId] = useState("");
  const [mapFilter, setMapFilter] = useState("all");
  const [mapBoxMinimized, setMapBoxMinimized] = useState(false);
  const [correctingAddress, setCorrectingAddress] = useState(false);
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [autocorrectPending, setAutocorrectPending] = useState(false);
  const [autocorrectError, setAutocorrectError] = useState("");
  const [installGuideRequest, setInstallGuideRequest] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<
    "login" | "register" | "reset"
  >("login");
  const [onboardingOpen, setOnboardingOpen] = useState<boolean | null>(null);
  const currentAuthId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const openLinkedView = () => {
      const linkedView = window.location.hash.slice(1);
      if (linkedView === "garage" || linkedView === "map") setView(linkedView);
    };
    openLinkedView();
    window.addEventListener("hashchange", openLinkedView);
    return () => window.removeEventListener("hashchange", openLinkedView);
  }, []);
  useLayoutEffect(() => {
    currentAuthId.current = auth.user?.id;
  }, [auth.user?.id]);
  const [dockHidden, setDockHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const challenge = useRef("");
  const searchChallenge = useRef<ChallengeHandle>(null);
  const searching = useRef(false);
  const verificationExpiry = useRef<number | null>(null);
  const [verifiedUntil, setVerifiedUntil] = useState<number | null>(null);
  const rememberVerification = useCallback((until: number | null) => {
    verificationExpiry.current = until;
    setVerifiedUntil(until);
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/search/verification", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (alive && !verificationExpiry.current && Number.isFinite(data?.verifiedUntil) && data.verifiedUntil > Date.now())
          rememberVerification(data.verifiedUntil);
      }).catch(() => {});
    return () => { alive = false; };
  }, [rememberVerification]);
  useEffect(() => {
    if (!verifiedUntil) return;
    const timer = setTimeout(() => rememberVerification(null), Math.max(0, verifiedUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [verifiedUntil, rememberVerification]);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const receiveChallenge = useCallback((token: string) => {
    challenge.current = token;
    if (token) {
      setCaptchaRequired(false);
      setError("");
    }
  }, []);
  const challengeEl = useRef<HTMLDivElement>(null);
  const notify = useCallback((s: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(s);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const api = auth.request;
  const refresh = useCallback(async () => {
    if (!auth.user) return;
    const userId = auth.user.id;
    try {
      const next = await api("me");
      if (currentAuthId.current === userId) setAccount(next);
    } catch (e) {
      notify((e as Error).message);
    }
  }, [api, notify, auth.user?.id]);
  useEffect(() => {
    if (auth.loading || onboardingOpen !== null) return;
    const callback =
      new URLSearchParams(location.search).has("auth") ||
      /access_token=|type=recovery/.test(location.hash);
    const seen = hasOnboarded(document.cookie);
    if (seen)
      document.cookie = onboardingCookie(location.protocol === "https:");
    setOnboardingOpen(!seen && !auth.user && !callback);
  }, [auth.loading, auth.user, onboardingOpen]);
  const finishOnboarding = (signup: boolean) => {
    document.cookie = onboardingCookie(location.protocol === "https:");
    setOnboardingOpen(false);
    if (signup) {
      setAuthInitialMode("register");
      setAuthOpen(true);
    }
  };
  const pendingSnapshots = !!account?.vehicles?.some(
    (vehicle: any) =>
      !vehicle.snapshot || vehicle.snapshot_status === "checking",
  );
  useEffect(() => {
    if (!auth.user || !auth.client || !pendingSnapshots) return;
    // Resume pending initial histories on a later visit, without admitting duplicate fetches.
    account.vehicles
      .filter((vehicle: any) => !vehicle.snapshot)
      .forEach((vehicle: any) => {
        void auth.client!.functions.invoke("vehicle-snapshots", {
          body: { mode: "refresh", vehicleId: vehicle.id },
        });
      });
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 10000;
      if (elapsed > 150000) {
        clearInterval(timer);
        return;
      }
      void refresh();
    }, 10000);
    return () => clearInterval(timer);
    // Start one bounded poll per account while initial work is pending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.client, auth.user?.id, pendingSnapshots]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const q = new URLSearchParams(location.search);
    if (nav.some((item) => item.id === q.get("view"))) setView(q.get("view")!);
    if (q.get("invite")) {
      setView("account");
    }
    const online = () => setOffline(!navigator.onLine);
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    const activePlate = plate.trim() || results?.query?.plate || "";
    let sub = "NYC Ticket Search";
    if (activePlate) {
      sub = `${activePlate.toUpperCase()} · ${tr("NYC Tickets")}`;
    } else if (view === "map") {
      sub = "Ticket Map";
    } else if (view === "timeline") {
      sub = "Timeline";
    } else if (view === "account") {
      sub = "Settings";
    }
    document.title = `${locale === "zh" ? "罚单卫士" : "TicketSafe"} | ${tr(sub)}`;
  }, [plate, results?.query?.plate, view, tr, locale]);
  useEffect(() => {
    setDockHidden(false);
    if (view === "map") return;
    const positions = new Map<
      EventTarget,
      {
        y: number;
        travel: number;
      }
    >();
    positions.set(document, { y: Math.max(0, window.scrollY), travel: 0 });
    document
      .querySelectorAll<HTMLElement>(
        ".main-view, .main-view .ticket-list, .main-view .content-page",
      )
      .forEach((element) => {
        positions.set(element, {
          y: Math.max(0, element.scrollTop),
          travel: 0,
        });
      });
    let hidden = false;
    const reveal = () => {
      hidden = false;
      setDockHidden(false);
    };
    let frame = 0;
    let source: HTMLElement | null = null;
    const update = () => {
      frame = 0;
      const target = source || document;
      const max = Math.max(
        0,
        source
          ? source.scrollHeight - source.clientHeight
          : document.documentElement.scrollHeight - window.innerHeight,
      );
      // Clamp both edges so elastic scrolling cannot reverse the dock animation.
      const y = Math.min(
        max,
        Math.max(0, source ? source.scrollTop : window.scrollY),
      );
      const previous = positions.get(target) || { y: 0, travel: 0 };
      const delta = y - previous.y;
      // Accumulate net travel rather than treating tiny reversals as a new gesture.
      const travel = hidden
        ? Math.min(0, previous.travel + delta)
        : Math.max(0, previous.travel + delta);
      positions.set(target, { y, travel });
      // Keep keyboard navigation visible and ignore Safari overscroll edges.
      if (
        y <= 12 ||
        y >= max - 8 ||
        document.activeElement?.matches(
          ".desktop-nav button:focus-visible, .mobile-nav button:focus-visible",
        )
      ) {
        reveal();
        positions.set(target, { y, travel: 0 });
      } else if (
        (!hidden && travel >= 80 && y > 60) ||
        (hidden && travel <= -24)
      ) {
        hidden = !hidden;
        setDockHidden(hidden);
        positions.set(target, { y, travel: 0 });
      }
    };
    const onScroll = (event: Event) => {
      if (sheet || authOpen) return;
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (element && !element.closest(".main-view")) return;
      source = element;
      if (!frame) frame = requestAnimationFrame(update);
    };
    document.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [view, sheet, authOpen]);
  useEffect(() => {
    // View changes should never inherit a scrolled-down position from Search.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);
  useEffect(() => {
    if (mapSelection) {
      setMapBoxMinimized(true);
      setCorrectingAddress(false);
      setAutocorrectError("");
    }
  }, [mapSelection]);
  useEffect(() => {
    let alive = true;
    setAccount(null);
    setVehicleId("");
    setSelected(null);
    setSheet(null);
    setTermsConsent(false);
    if (auth.user)
      api("me")
        .then((next) => {
          if (alive) {
            setAccount(next);
            setAuthOpen(false);
          }
        })
        .catch((error: Error) => {
          if (alive) notify(error.message);
        });
    return () => {
      alive = false;
    };
  }, [auth.user?.id, api, notify]);
  useEffect(() => {
    if (config.hcaptchaKey || !config.turnstileKey || !challengeEl.current)
      return;
    let widget: any;
    let timer: any;
    const render = () => {
      if ((window as any).turnstile && challengeEl.current) {
        widget = (window as any).turnstile.render(challengeEl.current, {
          sitekey: config.turnstileKey,
          theme: "auto",
          callback: (t: string) => (challenge.current = t),
          "expired-callback": () => (challenge.current = ""),
        });
        clearInterval(timer);
      }
    };
    if (!(window as any).turnstile) {
      let s = document.getElementById("turnstile-script");
      if (!s) {
        s = document.createElement("script");
        s.id = "turnstile-script";
        (s as HTMLScriptElement).src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        document.head.appendChild(s);
      }
      timer = setInterval(render, 300);
    } else render();
    return () => {
      clearInterval(timer);
      if (widget != null) (window as any).turnstile?.remove(widget);
    };
  }, [config.hcaptchaKey, config.turnstileKey, view, sheet]);
  const signIn = () => {
    if (!config.supabase) {
      setSheet("setup");
      return;
    }
    setAuthInitialMode("login");
    setAuthOpen(true);
  };
  const signOut = async () => {
    try {
      const result = await auth.client?.auth.signOut();
      if (result?.error) throw result.error;
    } catch {
      notify(tr("Could not sign out. Please try again."));
      return;
    }
    setAccount(null);
    setResults(null);
    setSelected(null);
    setSheet(null);
  };
  const perform = async (fn: () => Promise<any>, success?: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (success) notify(success);
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const search = useCallback(
    async (input: any) => {
      const p = normalizePlate(input);
      const saved = account?.vehicles?.find(
        (vehicle: any) =>
          vehicle.plate === p.plate &&
          vehicle.state === p.state &&
          vehicle.plate_type === p.plateType,
      )?.snapshot as SearchResult | undefined;
      if (saved) {
        setError("");
        setCaptchaRequired(false);
        setResults(saved);
        setMapVehicleId("");
        setPlate(p.plate);
        setState(p.state);
        setPlateType(p.plateType);
        setView("search");
        setSheet(null);
        return {
          count: saved.tickets.length,
          complete: saved.complete,
          unavailable: saved.unavailable,
        };
      }
      if (searching.current) throw new Error(tr("A search is already in progress."));
      searching.current = true;
      setBusy(true);
      setError("");
      try {
        const freshChallenge = async () => {
          if (!config.hcaptchaKey) return challenge.current;
          if (!searchChallenge.current) throw new Error(tr("Security check is loading. Please try again shortly."));
          return searchChallenge.current.execute();
        };
        let token = verificationExpiry.current && verificationExpiry.current > Date.now() ? "" : await freshChallenge();
        const request = (captcha: string) => fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...p,
            history: input.history ?? true,
            locations: true,
            challenge: captcha,
          }),
        });
        let r = await request(token);
        let j: any = await r.json();
        if (!token && r.status === 403 && j.code === "captcha_required") {
          rememberVerification(null);
          token = await freshChallenge();
          r = await request(token);
          j = await r.json();
        }
        const until = Number(r.headers.get("X-TicketSafe-Verified-Until"));
        if (until > Date.now()) rememberVerification(until);
        else if (token) rememberVerification(null);
        if (!r.ok && !j.sources)
          throw new Error(j.error || tr("NYC sources are unavailable."));
        setResults(j);
        setMapVehicleId("");
        setPlate(p.plate);
        setState(p.state);
        setPlateType(p.plateType);
        setView("search");
        setSheet(null);
        return {
          count: j.tickets.length,
          complete: j.complete,
          unavailable: j.unavailable,
        };
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        searching.current = false;
        setBusy(false);
        challenge.current = "";
        setCaptchaReset((value) => value + 1);
        (window as any).turnstile?.reset();
      }
    },
    [tr, account?.vehicles, config.hcaptchaKey, rememberVerification],
  );
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "search_nyc_tickets",
          description: tr(
            "Search NYC public violation datasets by plate and state and show the results. This search does not save a vehicle.",
          ),
          inputSchema: {
            type: "object",
            properties: {
              plate: { type: "string" },
              state: { type: "string" },
              plateType: { type: "string" },
            },
            required: ["plate", "state"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: search,
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, [search]);
  const vehicles = account?.vehicles || [];
  const allVehicles = vehicleId === "all" && vehicles.length > 0;
  const allHistory = useMemo(
    () =>
      combinedGarageHistory(account?.vehicles || [], account?.tickets || []),
    [account?.vehicles, account?.tickets],
  );
  const activeVehicle =
    vehicles.find((v: any) => v.id === vehicleId) || vehicles[0];
  const currentVehicleResults =
    activeVehicle &&
    results?.query.plate === activeVehicle.plate &&
    results?.query.state === activeVehicle.state &&
    results?.query.plateType === activeVehicle.plate_type;
  const garageTickets = allVehicles
    ? allHistory.tickets
    : currentVehicleResults
      ? results?.tickets || []
      : activeVehicle?.snapshot?.tickets ||
        (account?.tickets || []).filter(
          (t: any) => !activeVehicle || t.vehicleId === activeVehicle.id,
        );
  const tickets: Violation[] = results?.tickets || garageTickets;
  const searchedVehicle =
    results &&
    vehicles.find(
      (v: any) =>
        v.plate === results.query.plate &&
        v.state === results.query.state &&
        v.plate_type === results.query.plateType,
    );
  const mapScope =
    mapVehicleId === "all" || vehicles.some((v: any) => v.id === mapVehicleId)
      ? mapVehicleId
      : results
        ? searchedVehicle?.id || "search"
        : allVehicles
          ? "all"
          : activeVehicle?.id || "search";
  const mapVehicle = vehicles.find((v: any) => v.id === mapScope);
  const scopedMapTickets =
    mapScope === "all"
      ? allHistory.tickets
      : mapVehicle
        ? searchedVehicle?.id === mapScope
          ? results!.tickets
          : mapVehicle.snapshot?.tickets ||
            (account?.tickets || []).filter(
              (t: any) => t.vehicleId === mapVehicle.id,
            )
        : tickets;
  const locations = useMapLocations(
    scopedMapTickets,
    config.mapboxToken || undefined,
    view === "map",
  );
  const mapTickets = locations.tickets.filter(
    (t) =>
      mapFilter === "all" ||
      (mapFilter === "open" ? t.due != null && t.due > 0 : !!t.location.label),
  );
  const mapTicket = mapTickets.find((t) => t.id === mapSelection);
  const selectMapTicket = useCallback((t: Violation) => {
    setMapSelection(t.id);
    setMapBoxMinimized(true);
  }, []);
  const showTickets = tickets.filter(
    (t) =>
      filter === "all" ||
      (filter === "open" ? t.due != null && t.due > 0 : t.due === 0),
  );
  const openTicket = useCallback((t: Violation) => {
    setSelected(t);
    setSheet("ticket");
  }, []);
  const searchForm = (
    <form
      className="search-form"
      onSubmit={(e) => {
        e.preventDefault();
        search({ plate, state, plateType, history }).catch(() => {});
      }}
    >
      <div className="plate-input">
        <label htmlFor="plate">{tr("LICENSE PLATE")}</label>
        <input
          id="plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck
          placeholder={tr("Enter your plate")}
          maxLength={12}
          required
        />
      </div>
      <div className="search-options">
        <label className="field">
          {tr("Registration state")}
          <CustomSelect
            value={state}
            onChange={setState}
            options={STATES}
            label={tr("Registration state")}
          />
        </label>
        <label className="field">
          <span className="field-title">
            {tr("Plate type")}
            <span className="optional">{tr("Optional")}</span>
          </span>
          <CustomSelect
            value={plateType || "ALL"}
            onChange={(value) => setPlateType(value === "ALL" ? "" : value)}
            options={
              plateType && !PLATE_TYPES.some((p) => p.value === plateType)
                ? [...PLATE_TYPES, { value: plateType, label: plateType }]
                : PLATE_TYPES
            }
            label={tr("Plate type")}
          />
        </label>
      </div>
      <div className="history-option">
        <div className="history-option-copy">
          <span>{tr("Historical records")}</span>
          <small>{tr("From FY2014 onward")}</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={history}
          aria-label={tr("Include historical datasets back to FY2014")}
          className="history-switch"
          onClick={() => setHistory((value) => !value)}
        >
          <span className="history-switch-track">
            <span />
          </span>
        </button>
      </div>
      {!authOpen &&
        (config.hcaptchaKey ? (
          <div
            className={
              "search-verification" +
              (captchaRequired ? " verification-needed" : "")
            }
          >
            <BotChallenge
              ref={searchChallenge}
              mode="invisible"
              verifiedUntil={verifiedUntil}
              siteKey={config.hcaptchaKey}
              onToken={receiveChallenge}
              resetKey={captchaReset}
            />
            {captchaRequired && (
              <p className="error-text" role="alert">
                {tr("Please complete the security check before searching.")}
              </p>
            )}
          </div>
        ) : (
          <div className="challenge-container" ref={challengeEl} />
        ))}
      <button className="primary-action" disabled={busy || offline}>
        {busy ? (
          <LoaderCircle className="spin" size={19} />
        ) : (
          <Search size={18} />
        )}{" "}
        {busy ? tr("Checking NYC records…") : tr("Check my vehicle")}
        <ArrowRight size={18} />
      </button>
      {error && !captchaRequired && (
        <p className="error-text" role="alert">
          {tr(error)}
        </p>
      )}
      <p className="search-footnote">
        <LockKeyhole size={12} />
        {tr("No account needed to search. Your plate isn’t a public profile.")}
      </p>
    </form>
  );
  const saveVehicle = async (e: any) => {
    e.preventDefault();
    if (!account) {
      signIn();
      return;
    }
    const data = Object.fromEntries(new FormData(e.currentTarget));
    await perform(async () => {
      await api("vehicles", "POST", {
        ...(results?.query || { plate, state, plateType }),
        ...data,
      });
      await refresh();
      setSheet(null);
      setView("garage");
    }, tr("Vehicle saved to your garage."));
  };
  const go = (v: string) => {
    setView(v);
    setError("");
    setSheet(null);
    setDockHidden(false);
  };
  return (
    <div
      className={
        "app " + (view === "garage" && !activeVehicle ? "onboarding" : "")
      }
      data-view={view}
    >
      <a className="skip-link" href="#main-content">
        {tr("Skip to content")}
      </a>
      <InstallGuide
        manualRequest={installGuideRequest}
        suppressAutomatic={
          onboardingOpen !== false || authOpen || auth.recovering
        }
      />
      <PullToRefresh
        disabled={
          busy || !!sheet || !!onboardingOpen || authOpen || auth.recovering
        }
        onRefresh={async () => {
          if (!navigator.onLine)
            throw new Error(tr("You’re offline. Connect to refresh."));
          const response = await fetch("/api/config", { cache: "no-store" });
          if (!response.ok)
            throw new Error(tr("Refresh unavailable. Try again."));
          auth.setConfiguration(await response.json());
          if (results && ["search", "map"].includes(view)) {
            const current = view;
            try {
              const result = await search({ ...results.query, history });
              if (result.unavailable)
                throw new Error(
                  tr("City data is unavailable. Please try again later."),
                );
            } finally {
              setView(current);
            }
          }
          if (auth.user) {
            setAccount(await api("me"));
          }
        }}
      />
      <div className="atlas">
        {view === "map" ? (
          <Suspense fallback={<CityBackdrop />}>
            <CityMap
              tickets={mapTickets}
              token={config.mapboxToken || undefined}
              onSelect={selectMapTicket}
              interactive
              selectedId={mapTicket?.id}
            />
          </Suspense>
        ) : (
          <CityBackdrop />
        )}
      </div>
      <div className="ambient-grain" />
      <header className="app-header">
        <button
          className="wordmark"
          onClick={() => go("garage")}
          aria-label={tr("TicketSafe home")}
        >
          <span className="curb-mark">
            <span />
            <span />
            <span />
          </span>
          {locale === "zh" ? "罚单卫士" : "TicketSafe"}
          <span className="brand-period">.</span>
        </button>
        <nav
          className={`desktop-nav ${dockHidden ? "dock-hidden" : ""}`}
          inert={dockHidden}
          data-active={Math.max(
            0,
            nav.findIndex((n) => n.id === view),
          )}
          aria-label={tr("Primary navigation")}
        >
          <span className="nav-indicator" aria-hidden="true" />
          {nav.map((n) => (
            <button
              className={view === n.id ? "active" : ""}
              key={n.id}
              aria-current={view === n.id ? "page" : undefined}
              onClick={() => go(n.id)}
            >
              <n.icon size={15} />
              {tr(n.label)}
            </button>
          ))}
        </nav>
        <div className="header-right">
          {view !== "account" && (
            <button
              className="round-control"
              onClick={() => go("account")}
              aria-label={tr("Account settings")}
            >
              <UserRound size={19} />
            </button>
          )}
        </div>
      </header>
      {offline && (
        <div className="offline-banner">
          {tr(
            "You’re offline. Visible records may be out of date. Searches and changes are paused.",
          )}
        </div>
      )}
      <main id="main-content" className={"main-view view-" + view} key={view}>
        {view === "garage" && !activeVehicle && (
          <section className="welcome view-enter">
            <div className="welcome-context">
              <span className="location-label">
                <Navigation size={12} />
                {tr("NEW YORK CITY")}
              </span>
            </div>
            <div className="welcome-grid">
              <div className="welcome-title">
                <span className="eyebrow">
                  {tr("Your NYC driving companion")}
                </span>
                <h1>
                  {tr("Your car.")}
                  <br />
                  <span>{tr("Under control.")}</span>
                </h1>
                <p>
                  {tr("NYC tickets, a little clearer.")}
                  <span className="welcome-subtitle-extra">
                    {tr("Check your plate. Know your next move.")}
                  </span>
                </p>
                <div className="welcome-source">
                  <span className="source-icon">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    {tr("Direct from NYC Open Data")}
                    <span>
                      {tr(
                        "Parking & camera violations · All registration states",
                      )}
                    </span>
                  </div>
                </div>
                <div
                  className="welcome-features"
                  aria-label={tr("Included features")}
                >
                  <span>
                    <Ticket size={15} />
                    {tr("Real city records")}
                  </span>
                  <span>
                    <MapPin size={15} />
                    {tr("Violation locations")}
                  </span>
                  <span>
                    <CarFront size={15} />
                    {tr("Saved cars")}
                  </span>
                </div>
              </div>
              <div className="glass search-dock">
                <div className="dock-heading">
                  <span className="eyebrow">
                    {tr("01 / Find your vehicle")}
                  </span>
                  <CarFront size={20} />
                </div>
                {searchForm}
              </div>
            </div>
            <div className="welcome-bottom">
              <p>
                {tr("City records can take days or weeks to appear.")}
                <br />
                {tr(
                  "We show what’s available, with its source and check time.",
                )}
              </p>
            </div>
          </section>
        )}
        {view === "garage" && activeVehicle && (
          <section className="vehicle-scene view-enter">
            <div className="scene-top">
              <div className="segmented">
                <button
                  className={allVehicles ? "active" : ""}
                  aria-pressed={allVehicles}
                  onClick={() => {
                    setVehicleId("all");
                    setResults(null);
                    setMapVehicleId("all");
                    setMapSelection("");
                  }}
                >
                  {tr("All vehicles")}
                </button>
                {vehicles.map((v: any) => (
                  <button
                    key={v.id}
                    className={
                      !allVehicles && activeVehicle.id === v.id ? "active" : ""
                    }
                    onClick={() => {
                      setVehicleId(v.id);
                      setResults(v.snapshot || null);
                      setMapVehicleId("");
                      setMapSelection("");
                    }}
                  >
                    {v.nickname}
                  </button>
                ))}
              </div>
              <button
                className="round-control"
                aria-label={tr("Add vehicle")}
                onClick={() => go("search")}
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="vehicle-identity">
              <div className="garage-overview">
                <div className="eyebrow">
                  {allVehicles ? (
                    `${vehicles.length} ${tr("saved vehicles")}`
                  ) : (
                    <>
                      {activeVehicle.state} /{" "}
                      {activeVehicle.plate_type || tr("All plate types")}
                    </>
                  )}
                </div>
                <h1>
                  {allVehicles ? tr("All vehicles") : activeVehicle.plate}
                </h1>
                <div className="vehicle-subtitle">
                  {!allVehicles && activeVehicle.nickname && (
                    <span className="vehicle-nickname">
                      {activeVehicle.nickname}
                    </span>
                  )}
                  <span className="vehicle-check-time">
                    <Clock3 size={12} />
                    {allVehicles
                      ? tr("Combined saved histories")
                      : activeVehicle.checked_at
                        ? tr("Checked ") +
                          niceDate(
                            new Date(activeVehicle.checked_at).toISOString(),
                            locale,
                          )
                        : tr("Saved vehicle")}
                  </span>
                </div>
                <div className="scene-summary">
                  <div>
                    <strong>
                      {tr(
                        money(
                          garageTickets.some((t: any) => t.due != null)
                            ? garageTickets.reduce(
                                (s: number, t: any) => s + (t.due || 0),
                                0,
                              )
                            : null,
                        ),
                      )}
                    </strong>
                    <span>{tr("Known outstanding")}</span>
                  </div>
                  <div>
                    <strong>
                      {garageTickets.filter((t: any) => t.due > 0).length}
                    </strong>
                    <span>{tr("Open tickets")}</span>
                  </div>
                  {!allVehicles && (
                    <button
                      className="pill"
                      onClick={() => setSheet("vehicle")}
                    >
                      <SlidersHorizontal size={15} />
                      {tr("Vehicle settings")}
                    </button>
                  )}
                </div>
                <PlateBalance
                  tickets={garageTickets}
                  complete={
                    allVehicles
                      ? allHistory.complete
                      : activeVehicle.snapshot?.complete
                  }
                />
                {allVehicles && allHistory.ready < vehicles.length && (
                  <p className="small muted">
                    {allHistory.ready} / {vehicles.length}{" "}
                    {tr(
                      "saved histories ready. Remaining vehicles are still being checked.",
                    )}
                  </p>
                )}
              </div>
              {allVehicles ? (
                <button
                  className="primary-action garage-check-action"
                  onClick={() => {
                    setMapVehicleId("all");
                    go("map");
                  }}
                >
                  <MapPin size={17} />
                  {tr("View all locations")}
                </button>
              ) : (
                <button
                  className="primary-action garage-check-action"
                  disabled={busy}
                  onClick={() =>
                    search({
                      plate: activeVehicle.plate,
                      state: activeVehicle.state,
                      plateType: activeVehicle.plate_type,
                      history,
                    }).catch(() => {})
                  }
                >
                  <Search size={17} />
                  {tr(
                    activeVehicle.snapshot
                      ? "View full history"
                      : "Check this vehicle",
                  )}
                </button>
              )}
              {detailMode === "geek" && <VehicleData tickets={garageTickets} />}
              <div className="glass activity-dock">
                <div className="section-heading">
                  <h2>{tr("Ticket activity")}</h2>
                  <span className="mono muted">
                    {garageTickets.length.toLocaleString(locale)}{" "}
                    {tr("tickets")}
                  </span>
                </div>
                {garageTickets.length ? (
                  <TicketList
                    tickets={
                      allVehicles ? garageTickets : garageTickets.slice(0, 5)
                    }
                    showPlate={allVehicles}
                    onSelect={openTicket}
                  />
                ) : (
                  <p className="small muted">
                    {tr(
                      (
                        allVehicles
                          ? allHistory.ready === vehicles.length
                          : activeVehicle.snapshot
                      )
                        ? "No tickets found in the saved history."
                        : "Preparing your saved history. It will appear here automatically.",
                    )}
                  </p>
                )}
                <div className="dock-footer">
                  <Info size={13} />
                  {tr("Saved histories refresh every morning from city data.")}
                </div>
              </div>
            </div>
          </section>
        )}
        {view === "search" && (
          <section className="content-page view-enter">
            <div className="page-heading">
              <span className="eyebrow">{tr("NYC / Vehicle lookup")}</span>
              <h1>{tr("Search violations")}</h1>
            </div>
            <div className="search-layout">
              <div className="glass form-card">{searchForm}</div>
              <div>
                {!results ? (
                  <div className="glass empty">
                    <Search size={30} />
                    <h2>{tr("Your results start here.")}</h2>
                    <p>
                      {tr(
                        "Parking and camera violations issued in New York City, including vehicles registered elsewhere.",
                      )}
                    </p>
                    <div className="notice">
                      {tr(
                        "New tickets are published on the city’s schedule. A clear search does not guarantee you have no tickets.",
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="glass results-card">
                    <div className="results-heading">
                      <div>
                        <span className="eyebrow">
                          {results.query.state} /{" "}
                          {results.query.plateType || tr("All plate types")}
                        </span>
                        <h2>{results.query.plate}</h2>
                      </div>
                      <button
                        className="button"
                        onClick={() => (account ? setSheet("save") : signIn())}
                      >
                        <Plus size={15} />
                        {tr("Save vehicle")}
                      </button>
                    </div>
                    <div className="search-summary">
                      <div className="result-meta">
                        <span>
                          <Ticket size={13} />
                          <strong>
                            {results.tickets.length.toLocaleString(locale)}
                          </strong>{" "}
                          {tr("tickets found")}
                        </span>
                        <span>
                          <Clock3 size={13} />
                          {tr("Checked")}{" "}
                          {new Date(results.checkedAt).toLocaleTimeString(
                            locale === "zh" ? "zh-CN" : "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                        <span>
                          {tr("City data updated")}{" "}
                          {niceDate(
                            results.sources.find(
                              (source) => source.id === "nc67-uf89",
                            )?.updatedAt,
                            locale,
                          )}
                        </span>
                      </div>
                      <p className="plate-history-note">
                        {results.query.plateType
                          ? tr("Plate type matched exactly.")
                          : tr(
                              "Plate type not specified. Results may include different vehicle histories.",
                            )}
                      </p>
                    </div>
                    {!results.complete && (
                      <div className="notice warning">
                        {results.unavailable
                          ? tr("NYC sources did not respond. Please try again.")
                          : results.snapshot?.retainedRecords
                            ? tr(
                                "Some records were retained from an earlier check. Their disappearance does not confirm payment or dismissal.",
                              )
                            : tr(
                                "Some sources are unavailable or reached a result limit. These results are incomplete.",
                              )}
                      </div>
                    )}
                    {results.snapshot && (
                      <p className="small muted">
                        {tr(
                          results.snapshot.status === "retry"
                            ? "Showing the last saved history. The latest city check failed and will retry."
                            : "Saved history · refreshed every morning",
                        )}
                      </p>
                    )}
                    <PlateBalance
                      tickets={results.tickets}
                      complete={results.complete}
                    />
                    {detailMode === "geek" && (
                      <VehicleData tickets={results.tickets} />
                    )}
                    <div className="tabs">
                      {["all", "open", "resolved"].map((f) => (
                        <button
                          className={filter === f ? "active" : ""}
                          key={f}
                          onClick={() => setFilter(f)}
                        >
                          {f === "resolved"
                            ? tr("No balance")
                            : tr(f.charAt(0).toUpperCase() + f.slice(1))}
                        </button>
                      ))}
                    </div>
                    {showTickets.length ? (
                      <TicketList tickets={showTickets} onSelect={openTicket} />
                    ) : (
                      <div className="empty">
                        <CheckCircle2 size={27} />
                        <h2>
                          {results.unavailable
                            ? tr("Records unavailable")
                            : filter === "all"
                              ? tr("No records found.")
                              : tr("No matching records.")}
                        </h2>
                        <p>
                          {results.unavailable
                            ? tr("This is not a clear result.")
                            : tr(
                                "Only the sources listed below were checked. Recent tickets may not appear yet.",
                              )}
                        </p>
                      </div>
                    )}
                    {detailMode === "geek" && (
                      <details className="source-details">
                        <summary>
                          {tr("Source coverage")}
                          <ChevronDown size={14} />
                        </summary>
                        {results.sources.map((s) => (
                          <div key={s.id}>
                            <span>{tr(s.name)}</span>
                            <span className={s.ok ? "muted" : "amber"}>
                              {s.ok
                                ? s.count + tr(" records")
                                : tr("Unavailable")}
                            </span>
                            <small>
                              {tr("Source updated:")}
                              {niceDate(s.updatedAt, locale)} ·{" "}
                              {s.truncated
                                ? tr("Limit reached")
                                : tr("Checked ") +
                                  niceDate(s.checkedAt, locale)}
                            </small>
                          </div>
                        ))}
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        {view === "map" && (
          <section className="map-scene view-enter">
            <div className="map-scene-heading">
              <h1>{tr("Violation locations")}</h1>
              <div className="map-coverage">
                <span>
                  <MapPin size={12} />
                  <strong>
                    {mapTickets.filter((t) => hasPoint(t.location)).length}
                  </strong>{" "}
                  {tr("mapped")}
                </span>
                <span>
                  <strong>
                    {mapTickets.filter((t) => !!t.location.label).length}
                  </strong>{" "}
                  {tr("with an address")}
                </span>
              </div>
              {vehicles.length > 1 && (
                <div className="map-vehicle-picker">
                  <CustomSelect
                    label="Map vehicle"
                    value={mapScope}
                    onChange={(id) => {
                      setMapVehicleId(id);
                      setMapSelection("");
                      setMapBoxMinimized(false);
                      setCorrectingAddress(false);
                    }}
                    options={[
                      { value: "all", label: tr("All vehicles") },
                      ...vehicles.map((v: any) => ({
                        value: v.id,
                        label: `${v.nickname || v.plate} · ${v.plate} (${v.state})`,
                      })),
                      ...(results && !searchedVehicle
                        ? [
                            {
                              value: "search",
                              label: `${tr("Current search")} · ${results.query.plate}`,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              )}
            </div>
            <div
              className={
                "glass map-results" +
                (mapTicket ? " map-results-compact" : "") +
                (mapBoxMinimized ? " map-box-minimized" : "")
              }
              tabIndex={0}
              aria-label={
                mapTicket ? tr("Selected ticket") : tr("Ticket locations")
              }
            >
              {!mapTicket && mapBoxMinimized && (
                <div
                  className="map-list-minimized"
                  onClick={() => setMapBoxMinimized(false)}
                  onKeyDown={(e) => {
                    if (["Enter", " "].includes(e.key)) {
                      e.preventDefault();
                      setMapBoxMinimized(false);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={tr("Expand ticket locations list")}
                >
                  <div className="map-list-minimized-info">
                    <MapPin size={15} className="map-list-minimized-icon" />
                    <span>
                      {mapTickets.length}{" "}
                      {mapTickets.length === 1
                        ? tr("ticket location")
                        : tr("ticket locations")}
                    </span>
                  </div>
                  <div className="map-box-controls">
                    <button
                      className="map-box-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMapBoxMinimized(false);
                      }}
                      aria-label={tr("Expand locations list")}
                      title={tr("Expand locations list")}
                    >
                      <ChevronUp size={16} />
                    </button>
                  </div>
                </div>
              )}
              {!mapTicket && !mapBoxMinimized && (
                <>
                  <div className="section-heading">
                    <h2>{tr("Locations")}</h2>
                    <div
                      className="row"
                      style={{ gap: 8, alignItems: "center" }}
                    >
                      {activeVehicle && (
                        <button
                          className="text-link"
                          onClick={() =>
                            perform(async () => {
                              await api("locations", "POST", {
                                vehicleId: activeVehicle.id,
                              });
                              await refresh();
                            }, tr("Locations checked"))
                          }
                        >
                          {tr("Refresh")}
                          <RefreshCw size={13} />
                        </button>
                      )}
                      <div className="map-box-controls">
                        <button
                          className="map-box-icon-btn"
                          onClick={() => setMapBoxMinimized(true)}
                          aria-label={tr("Minimize locations list")}
                          title={tr("Minimize locations list")}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="map-helper">
                    {tr(
                      "Addresses work too. Select a ticket to explore its location.",
                    )}
                  </p>
                  {!!scopedMapTickets.length && (
                    <div className="tabs" aria-label={tr("Map ticket filters")}>
                      {[
                        ["all", tr("All tickets")],
                        ["open", tr("Outstanding")],
                        ["address", tr("With address")],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          className={mapFilter === value ? "active" : ""}
                          aria-pressed={mapFilter === value}
                          onClick={() => setMapFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {locations.resolving && (
                    <p className="map-lookup-status" role="status">
                      <LoaderCircle size={14} className="spin" />
                      {tr("Finding addresses on the map…")}
                    </p>
                  )}
                  {locations.error && (
                    <p className="map-lookup-status" role="status">
                      {tr(locations.error)}
                    </p>
                  )}
                  {locations.hasMore && (
                    <button
                      className="text-link"
                      disabled={locations.resolving}
                      onClick={locations.resolveMore}
                    >
                      {tr("Locate more addresses")}
                      <MapPin size={13} />
                    </button>
                  )}
                  {mapTickets.length ? (
                    <TicketList
                      tickets={mapTickets}
                      onSelect={selectMapTicket}
                      showPlate={mapScope === "all"}
                    />
                  ) : (
                    <div className="empty">
                      <MapPin size={27} />
                      <h2>
                        {scopedMapTickets.length
                          ? tr("No tickets match this filter.")
                          : tr("No ticket locations yet.")}
                      </h2>
                      <p>
                        {tr(
                          "Search a vehicle to see addresses from city records. Tickets without a reliable location remain in the list.",
                        )}
                      </p>
                      <button className="button" onClick={() => go("search")}>
                        {tr("Search a plate")}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </>
              )}
              {mapTicket && mapBoxMinimized && (
                <div className="map-selection-compact" aria-live="polite">
                  <div
                    className="map-selection-compact-info"
                    onClick={() => setMapBoxMinimized(false)}
                    onKeyDown={(e) => {
                      if (["Enter", " "].includes(e.key)) {
                        e.preventDefault();
                        setMapBoxMinimized(false);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={tr("Expand details")}
                  >
                    <span className="map-selection-compact-title">
                      {mapTicket.location.label || tr("Location not provided")}
                    </span>
                    <span className="map-selection-compact-meta">
                      {niceDate(mapTicket.issued, locale)} ·{" "}
                      <strong>{tr(money(mapTicket.due))}</strong>
                    </span>
                  </div>
                  <div className="map-selection-compact-actions">
                    <button
                      className="compact-action-btn"
                      onClick={() => openTicket(mapTicket)}
                    >
                      {tr("View")}
                      <ArrowUpRight size={13} />
                    </button>
                    <div className="map-box-controls">
                      <button
                        className="map-box-icon-btn"
                        onClick={() => setMapBoxMinimized(false)}
                        aria-label={tr("Expand details")}
                        title={tr("Expand details")}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        className="map-box-icon-btn"
                        onClick={() => setMapSelection("")}
                        aria-label={tr("Show all tickets")}
                        title={tr("Show all tickets")}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {mapTicket && !mapBoxMinimized && (
                <div className="map-selection" aria-live="polite">
                  <div
                    className="row spread"
                    style={{ alignItems: "center", marginBottom: 8, gap: 12 }}
                  >
                    <span className="eyebrow" style={{ flex: 1, minWidth: 0 }}>
                      {hasPoint(mapTicket.location)
                        ? tr(mapTicket.location.precision) + tr(" location")
                        : tr("Address on record")}
                    </span>
                    <div className="map-box-controls">
                      <button
                        aria-label={tr("Minimize to compact")}
                        title={tr("Minimize to compact")}
                        className="map-box-icon-btn"
                        onClick={() => setMapBoxMinimized(true)}
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        aria-label={tr("Show all tickets")}
                        title={tr("Show all tickets")}
                        className="map-box-icon-btn"
                        onClick={() => setMapSelection("")}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                  <h3>
                    {mapTicket.location.label || tr("Location not provided")}
                  </h3>
                  {mapTicket.location.matchedAddress &&
                    mapTicket.location.matchedAddress !==
                      mapTicket.location.label && (
                      <p className="location-matched-sub">
                        {tr("Mapped to")}: {mapTicket.location.matchedAddress}
                      </p>
                    )}
                  <p>
                    {tr(mapTicket.description)} ·{" "}
                    {niceDate(mapTicket.issued, locale)}
                  </p>
                  <div className="selected-ticket-amount">
                    <strong>{tr(money(mapTicket.due))}</strong>
                    <span>{tr("Reported balance")}</span>
                  </div>
                  {hasPoint(mapTicket.location) && (
                    <p className="location-radius-note">
                      {contextRadius(mapTicket.location)}{" "}
                      {tr(
                        "m approximate context ring · illustrative, not an official incident boundary.",
                      )}
                    </p>
                  )}
                  {!hasPoint(mapTicket.location) && (
                    <p className="map-match">
                      {locations.resolving
                        ? tr("Looking up this address…")
                        : tr(
                            "No reliable map match yet. The recorded address is shown above.",
                          )}
                    </p>
                  )}

                  {!correctingAddress ? (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="text-link"
                        style={{
                          fontSize: 11,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                        onClick={() => {
                          setCorrectingAddress(true);
                          setCustomAddressInput(
                            cleanLocationLabel(mapTicket.location.label),
                          );
                        }}
                      >
                        <Edit3 size={11} />
                        {hasPoint(mapTicket.location)
                          ? tr("Edit or correct address")
                          : tr("Enter correct address")}
                      </button>
                    </div>
                  ) : (
                    <form
                      className="autocorrect-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!customAddressInput.trim()) return;
                        setAutocorrectPending(true);
                        setAutocorrectError("");
                        const loc = await locations.autocorrectLocation(
                          mapTicket,
                          customAddressInput.trim(),
                        );
                        setAutocorrectPending(false);
                        if (!loc) {
                          setAutocorrectError(
                            tr(
                              "No reliable map match found. Try adding a borough (e.g. Queens, Brooklyn).",
                            ),
                          );
                        } else {
                          setCorrectingAddress(false);
                        }
                      }}
                    >
                      <div className="row" style={{ gap: 6, marginTop: 8 }}>
                        <input
                          type="text"
                          className="autocorrect-input"
                          value={customAddressInput}
                          onChange={(e) =>
                            setCustomAddressInput(e.target.value)
                          }
                          placeholder={tr("Enter street & borough…")}
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="button primary"
                          style={{
                            minHeight: 34,
                            height: 34,
                            padding: "0 12px",
                            fontSize: 12,
                          }}
                          disabled={
                            autocorrectPending || !customAddressInput.trim()
                          }
                        >
                          {autocorrectPending ? (
                            <LoaderCircle size={12} className="spin" />
                          ) : (
                            tr("Locate")
                          )}
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          style={{
                            minHeight: 34,
                            height: 34,
                            padding: "0 10px",
                            fontSize: 12,
                          }}
                          onClick={() => setCorrectingAddress(false)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                      {autocorrectError && (
                        <p className="autocorrect-error">{autocorrectError}</p>
                      )}
                    </form>
                  )}
                  <div className="row" style={{ gap: 8, marginTop: 12 }}>
                    <button
                      className="button primary"
                      style={{ flex: 1 }}
                      onClick={() => openTicket(mapTicket)}
                    >
                      {tr("View violation")}
                      <ArrowUpRight size={14} />
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setMapBoxMinimized(true)}
                      aria-label={tr("Minimize to compact")}
                      style={{ padding: "0 14px" }}
                    >
                      <ChevronDown size={14} />
                      {tr("Minimize")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        {view === "account" && (
          <section className="content-page account-page view-enter">
            <div className="page-heading">
              <span className="eyebrow">{tr("Your preferences")}</span>
              <h1>{tr("Account")}</h1>
              <p>{tr("Your preferences, your way.")}</p>
            </div>

            <div className="account-layout">
              <div className="glass form-card stack account-signin-panel">
                <div className="account-identity-heading">
                  <span className="account-profile-mark">
                    <UserRound size={20} />
                  </span>
                  <div>
                    <h2>{tr("Your account")}</h2>
                    <span>
                      {tr(
                        account
                          ? "Private and secure"
                          : "A place for your vehicles",
                      )}
                    </span>
                  </div>
                </div>
                {!account ? (
                  <>
                    <p className="small muted">
                      {tr(
                        "Create an account to save cars and access your garage on any device.",
                      )}
                    </p>
                    <button className="primary-action" onClick={signIn}>
                      <LogIn size={17} />
                      {tr("Create account or sign in")}
                      <ArrowRight size={17} />
                    </button>
                    {!config.services.accounts && (
                      <p className="small muted">
                        {tr(
                          "Account activation is awaiting service setup. Live search remains available.",
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="small">
                      {account.user.email}
                      <br />
                      <span className="badge">
                        {FREE_ACCESS
                          ? tr("Free access")
                          : tr(account.user.plan) + " " + tr("plan")}
                      </span>
                    </p>

                    {
                      <button
                        className="account-tool"
                        onClick={() => setSheet("account-details")}
                      >
                        <span className="account-tool-icon">
                          <UserRound size={19} />
                        </span>
                        <span>
                          <strong>{tr("Account details")}</strong>
                          <small>
                            {tr("Email, password, and account security")}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    }
                    <button
                      className="button ghost"
                      onClick={() => void signOut()}
                    >
                      <LogOut size={15} />
                      {tr("Sign out")}
                    </button>
                    <details>
                      <summary className="small muted">
                        {tr("Account data")}
                      </summary>
                      <p className="small muted">
                        {tr(
                          "Remove saved cars, or permanently delete your account from Account details.",
                        )}
                      </p>
                      <button
                        className="text-link"
                        onClick={() => setSheet("delete")}
                      >
                        {tr("Delete my TicketSafe data")}
                      </button>
                    </details>
                  </>
                )}
              </div>
              {account && <div className="glass form-card account-notifications-card">
                <NotificationSettings legalAccepted={account.user.legalAccepted === true} />
              </div>}
              <div className="glass form-card account-tools-card">
                <h2>{tr("Your TicketSafe")}</h2>
                <button
                  className="account-tool"
                  onClick={() => setSheet("preferences")}
                >
                  <span className="account-tool-icon">
                    <SlidersHorizontal size={19} />
                  </span>
                  <span>
                    <strong>{tr("Display settings")}</strong>
                    <small>
                      {tr("Appearance, language, and detail level")}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
                <button
                  className="account-tool"
                  onClick={() => setInstallGuideRequest((n) => n + 1)}
                >
                  <span className="account-tool-icon">
                    <Download size={19} />
                  </span>
                  <span>
                    <strong>{tr("Add to Home Screen")}</strong>
                    <small>{tr("Open TicketSafe with a single tap")}</small>
                  </span>
                  <ChevronRight size={16} />
                </button>

                <p className="account-free-note">
                  <Check size={13} />
                  {tr("Free access to searches and saved cars.")}
                </p>
              </div>
            </div>

            <div
              className="glass form-card account-legal-card"
              style={{ marginTop: 20 }}
            >
              <div className="row spread">
                <h2>{tr("Legal & disclosures")}</h2>
                <ShieldCheck size={20} />
              </div>
              <p className="small muted">
                {tr(
                  "Review our privacy commitments, service terms, accessibility standards, and public mapping data sources.",
                )}
              </p>
              <div className="account-legal-grid">
                <a className="account-legal-item" href="/legal/privacy">
                  <div className="account-legal-item-icon">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="account-legal-item-text">
                    <strong>{tr("Privacy Policy")}</strong>
                    <span>
                      {tr(
                        "How your plate, email, and vehicle data are protected.",
                      )}
                    </span>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="account-legal-item-arrow"
                  />
                </a>
                <a className="account-legal-item" href="/legal/terms">
                  <div className="account-legal-item-icon">
                    <FileText size={16} />
                  </div>
                  <div className="account-legal-item-text">
                    <strong>{tr("Terms of Service")}</strong>
                    <span>
                      {tr(
                        "Your rights and responsibilities when using TicketSafe.",
                      )}
                    </span>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="account-legal-item-arrow"
                  />
                </a>
                <a className="account-legal-item" href="/legal/accessibility">
                  <div className="account-legal-item-icon">
                    <Accessibility size={16} />
                  </div>
                  <div className="account-legal-item-text">
                    <strong>{tr("Accessibility")}</strong>
                    <span>
                      {tr(
                        "WCAG 2.2 standards, screen reader, and keyboard support.",
                      )}
                    </span>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="account-legal-item-arrow"
                  />
                </a>
                <a className="account-legal-item" href="/legal">
                  <div className="account-legal-item-icon">
                    <Info size={16} />
                  </div>
                  <div className="account-legal-item-text">
                    <strong>{tr("All Legal Policies")}</strong>
                    <span>
                      {tr(
                        "Terms, privacy, accessibility, and data sources in one place.",
                      )}
                    </span>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="account-legal-item-arrow"
                  />
                </a>
              </div>
              <a className="account-source-summary" href="/legal/sources">
                <MapPin size={16} />
                <div>
                  <strong>{tr("Map data and geographic information")}</strong>
                  <span>{tr("View data sources and location accuracy")}</span>
                </div>
                <ChevronRight size={16} aria-hidden="true" />
              </a>
            </div>
          </section>
        )}

        <footer className="page-footer">
          <span>{tr("Independent service. Not affiliated with NYC.")}</span>
        </footer>
      </main>
      <div
        className={`mobile-nav-scrim ${dockHidden ? "dock-hidden" : ""}`}
        aria-hidden="true"
      />
      <nav
        className={`mobile-nav ${dockHidden ? "dock-hidden" : ""}`}
        inert={dockHidden}
        data-active={Math.max(
          0,
          nav.findIndex((n) => n.id === view),
        )}
        aria-label={tr("Mobile navigation")}
      >
        <span className="nav-indicator" aria-hidden="true" />
        {nav.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? "active" : ""}
            aria-current={view === n.id ? "page" : undefined}
            onClick={() => go(n.id)}
          >
            <n.icon size={21} />
            <span>{tr(n.label)}</span>
          </button>
        ))}
      </nav>
      {(authOpen || auth.recovering) && (
        <Modal
          title={tr(auth.recovering ? "Reset password" : "Your account")}
          close={() => {
            setAuthOpen(false);
            if (auth.recovering) void signOut();
          }}
        >
          {auth.client ? (
            <AuthPanel
              client={auth.client}
              recovering={auth.recovering}
              initialMode={authInitialMode}
              initialEmail={
                authInitialMode === "reset" ? auth.user?.email : undefined
              }
              onComplete={() => {
                setAuthOpen(false);
                auth.setRecovering(false);
              }}
            />
          ) : (
            <p role="status">
              {tr(
                auth.error
                  ? "Sign-in is unavailable right now. Please try again later."
                  : "Account sign-in is loading. Please try again shortly.",
              )}
            </p>
          )}
        </Modal>
      )}
      {onboardingOpen && !authOpen && !auth.recovering && (
        <Modal
          title={tr("Welcome to TicketSafe")}
          motion="up"
          close={() => finishOnboarding(false)}
        >
          <WelcomeOnboarding
            canSignUp={!!config.supabase}
            finish={finishOnboarding}
          />
        </Modal>
      )}

      {account &&
        !account.user.legalAccepted &&
        !authOpen &&
        !auth.recovering && (
          <Modal title={tr("A clear agreement")} close={() => void signOut()}>
            <div className="stack">
              <p className="small muted">
                {tr(
                  "Before saving cars, please review our service terms and privacy policy.",
                )}
              </p>
              <p className="consent-links">
                <a href="/legal/terms" target="_blank" rel="noreferrer">
                  {tr("Read Terms of service")}
                </a>
                {" · "}
                <a href="/legal/privacy" target="_blank" rel="noreferrer">
                  {tr("Read Privacy policy")}
                </a>
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={termsConsent}
                  onChange={(event) => setTermsConsent(event.target.checked)}
                />
                <span>
                  {tr(
                    "I am at least 18 and agree to the Terms of service, version",
                  )}{" "}
                  {LEGAL_VERSION}
                  {tr(". I acknowledge the Privacy Policy.")}
                </span>
              </label>
              <button
                className="primary-action"
                disabled={!termsConsent || busy}
                onClick={() =>
                  perform(async () => {
                    await api("legal", "POST", {
                      accepted: true,
                      adult: true,
                      version: LEGAL_VERSION,
                    });
                    await refresh();
                  })
                }
              >
                {tr("Agree and continue")}
                <ArrowRight size={16} />
              </button>
            </div>
          </Modal>
        )}

      {sheet && (
        <Modal
          title={
            sheet === "preferences"
              ? tr("Display settings")
              : sheet === "account-details"
                ? tr("Account details")
                : sheet === "ticket"
                  ? tr("Violation details")
                  : sheet === "save"
                    ? tr("Add to your garage")
                    : sheet === "vehicle"
                      ? tr("Vehicle settings")
                      : sheet === "privacy"
                        ? tr("Your data. Your control.")
                        : sheet === "delete"
                          ? tr("Delete saved data?")
                          : sheet === "delete-account"
                            ? tr("Delete account?")
                            : tr("Account activation")
          }
          close={() => setSheet(null)}
        >
          {sheet === "account-details" && auth.user && (
            <AccountDetails
              key={auth.user.id}
              onDeleteAccount={() => {
                setDeleteConfirmed(false);
                setError("");
                setSheet("delete-account");
              }}
              onResetPassword={() => {
                setSheet(null);
                setAuthInitialMode("reset");
                setAuthOpen(true);
              }}
            />
          )}
          {sheet === "preferences" && (
            <PreferencesPanel
              onCancel={() => setSheet(null)}
              onSave={() => {
                setSheet(null);
                notify(tr("Settings saved"));
              }}
            />
          )}
          {sheet === "setup" && (
            <div className="stack">
              <LockKeyhole size={28} />
              <p>{tr("Account sign-in hasn’t been activated yet.")}</p>
              <p className="small muted">
                {tr(
                  "You can search NYC records now. Saving vehicles requires account sign-in to be configured.",
                )}
              </p>
              <button
                className="primary-action"
                onClick={() => {
                  setSheet(null);
                  go("search");
                }}
              >
                {tr("Search a plate")}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
          {sheet === "privacy" && (
            <div className="stack small">
              <p>
                {tr(
                  "Searches query public NYC Department of Finance datasets. Ticket histories may belong to previous users of a plate. City records may be delayed, incomplete, or corrected later.",
                )}
              </p>
              <p>
                {tr(
                  "Saved cars and display preferences are private to your account.",
                )}
              </p>
              <p>
                {tr(
                  "Deleting a saved vehicle removes it from your garage. Public city records remain available through a plate search.",
                )}
              </p>
              <a
                className="text-link"
                href="https://data.cityofnewyork.us/City-Government/Open-Parking-and-Camera-Violations/nc67-uf89"
                target="_blank"
                rel="noreferrer"
              >
                {tr("NYC violation data")}
                <ArrowUpRight size={14} />
              </a>
              <a
                className="text-link"
                href="https://www.nyc.gov/main/services/parking-and-camera-tickets"
                target="_blank"
                rel="noreferrer"
              >
                {tr("Official NYC ticket guidance")}
                <ArrowUpRight size={14} />
              </a>
              <p className="muted">
                {tr(
                  "Use official NYC guidance to review ticket deadlines and available next steps.",
                )}
              </p>
            </div>
          )}
          {sheet === "save" && (
            <form className="stack" onSubmit={saveVehicle}>
              <div className="eyebrow">
                {results?.query.state} / {results?.query.plate}
              </div>
              <label className="field">
                {tr("Vehicle nickname")}
                <input
                  name="nickname"
                  placeholder={tr("My daily driver")}
                  required
                  maxLength={60}
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  {tr("Make")}
                  <input name="make" placeholder={tr("Optional")} />
                </label>
                <label className="field">
                  {tr("Model")}
                  <input name="model" placeholder={tr("Optional")} />
                </label>
                <label className="field">
                  {tr("Year")}
                  <input
                    name="year"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder={tr("Optional")}
                  />
                </label>
                <label className="field">
                  {tr("Color")}
                  <input name="color" placeholder={tr("Optional")} />
                </label>
              </div>
              <label className="check-row">
                <input type="checkbox" required />
                {tr("I own or am authorized to save this vehicle.")}
              </label>
              <p className="small muted">
                {tr(
                  "Saving a car keeps its ticket history ready and refreshes it every morning from city data.",
                )}
              </p>
              <button className="primary-action" disabled={busy}>
                {tr("Save vehicle")}
                <Plus size={17} />
              </button>
            </form>
          )}
          {sheet === "vehicle" && activeVehicle && (
            <div className="stack">
              <h2>{activeVehicle.plate}</h2>
              <p className="small muted">
                {tr("Saved on")}{" "}
                {niceDate(
                  new Date(activeVehicle.created_at).toISOString(),
                  locale,
                )}
                {tr(
                  ". Vehicle descriptions are entered by you and do not verify ownership.",
                )}
              </p>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  perform(async () => {
                    await api("vehicles/" + activeVehicle.id, "PATCH", {
                      nickname: f.get("nickname"),
                      ...{
                        make: f.get("make"),
                        model: f.get("model"),
                        year: f.get("year"),
                        color: f.get("color"),
                      },
                    });
                    await refresh();
                  }, tr("Vehicle updated"));
                }}
              >
                <label className="field">
                  {tr("Nickname")}
                  <input
                    name="nickname"
                    defaultValue={activeVehicle.nickname}
                  />
                </label>

                {
                  <div className="form-grid">
                    {(["make", "model", "year", "color"] as const).map(
                      (field) => (
                        <label className="field" key={field}>
                          {tr(
                            {
                              make: "Make",
                              model: "Model",
                              year: "Year",
                              color: "Color",
                            }[field],
                          )}
                          <input
                            name={field}
                            defaultValue={activeVehicle[field] ?? ""}
                            maxLength={field === "year" ? 4 : 80}
                            inputMode={field === "year" ? "numeric" : "text"}
                          />
                        </label>
                      ),
                    )}
                  </div>
                }
                <button className="button primary">
                  {tr("Save settings")}
                </button>
              </form>
              <button
                className="text-link"
                onClick={() =>
                  perform(async () => {
                    await api("vehicles/" + activeVehicle.id, "DELETE");
                    await refresh();
                    setSheet(null);
                  }, tr("Vehicle removed"))
                }
              >
                {tr("Remove saved vehicle")}
              </button>
            </div>
          )}
          {sheet === "ticket" && selected && (
            <div className="stack">
              <div className="ticket-detail-title">
                <span className="eyebrow">
                  {selected.plate} / {selected.state}
                </span>
                <h2>{tr(selected.description)}</h2>
                <strong>{tr(money(selected.due))}</strong>
                <span className="muted small">{tr("Reported amount due")}</span>
              </div>
              <div className="notice">
                {selected.localStatus
                  ? tr("Marked ") +
                    tr(selected.localStatus) +
                    tr(" by you. City confirmation may still be pending.")
                  : selected.status === "Unknown"
                    ? tr(
                        "Historical issuance record. Current payment status is unknown.",
                      )
                    : tr(selected.status)}
              </div>
              <dl className="detail-grid">
                {[
                  [tr("Summons"), selected.id],
                  [tr("Issue date"), niceDate(selected.issued, locale)],
                  [
                    tr("Time"),
                    selected.time?.replace(
                      /^0?(\d{1,2}):([0-5]\d)([AP])$/,
                      "$1:$2 $3M",
                    ),
                  ],
                  [tr("Location"), selected.location.label],
                  ...(detailMode === "geek"
                    ? [
                        [tr("Violation code"), selected.code],
                        [tr("Issuing agency"), selected.agency],
                        [tr("Plate type"), selected.plateType],
                        [
                          tr("Notice date"),
                          niceDate(selected.noticeDate, locale),
                        ],
                        [tr("Location precision"), selected.location.precision],
                        ...(selected.location.resolvedBy
                          ? [
                              [
                                tr("Location lookup"),
                                selected.location.resolvedBy,
                              ],
                            ]
                          : []),
                        [tr("Checked"), niceDate(selected.checkedAt, locale)],
                      ]
                    : []),
                  [
                    tr("Action date"),
                    selected.actionDate
                      ? niceDate(selected.actionDate, locale) +
                        " (" +
                        tr(selected.deadlineBasis) +
                        tr(" + 30 days)")
                      : tr("Confirm from official notice"),
                  ],
                  ...(detailMode === "geek"
                    ? Object.entries(selected.vehicle || {}).map(
                        ([key, value]) => [
                          tr("City-reported vehicle") + " · " + tr(key),
                          value,
                        ],
                      )
                    : []),
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className={
                      k === tr("Summons")
                        ? "detail-field-wide detail-field-summons"
                        : k === tr("Location")
                          ? "detail-field-wide"
                          : k === tr("Action date")
                            ? "detail-field-wide detail-field-action"
                            : undefined
                    }
                  >
                    <dt>{k}</dt>
                    <dd>{v ? tr(String(v)) : tr("Not provided")}</dd>
                  </div>
                ))}
              </dl>
              <TicketLocation
                key={selected.id}
                ticket={selected}
                token={config.mapboxToken || undefined}
                onOpen={(ticket) => {
                  setMapSelection(ticket.id);
                  setMapFilter("all");
                  setSheet(null);
                  setView("map");
                }}
              />
              <div className="money-table">
                {[
                  [tr("Fine"), selected.fine],
                  [tr("Penalties"), selected.penalty],
                  [tr("Interest"), selected.interest],
                  [tr("Reductions"), selected.reduction],
                  [tr("Payments"), selected.payments],
                  [tr("Reported balance"), selected.due],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <span>{tr(money(v as number))}</span>
                  </div>
                ))}
              </div>
              {selected.image && (
                <a
                  className="button"
                  href={selected.image}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tr("View official summons image")}
                  <ArrowUpRight size={14} />
                </a>
              )}
              <a
                className="primary-action"
                href="https://www.nyc.gov/main/services/parking-and-camera-tickets"
                target="_blank"
                rel="noreferrer"
              >
                {tr("Official NYC ticket guidance")}
                <ArrowUpRight size={17} />
              </a>
              {detailMode === "geek" && (
                <details className="source-details">
                  <summary>
                    {tr("Record sources")}
                    <ChevronDown size={13} />
                  </summary>
                  {selected.sources.map((s: string) => (
                    <a
                      key={s}
                      className="text-link"
                      href={"https://data.cityofnewyork.us/d/" + s}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s}
                      <ArrowUpRight size={12} />
                    </a>
                  ))}
                  <dl className="field-provenance">
                    {Object.entries(selected.provenance || {}).map(
                      ([field, source]) => (
                        <div key={field}>
                          <dt>{tr(field)}</dt>
                          <dd>{String(source)}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                </details>
              )}
              <p className="small muted">
                {tr(
                  "Review the official notice for deadlines. Missing a record or a balance does not establish dismissal.",
                )}
              </p>
            </div>
          )}

          {sheet === "delete" && (
            <div className="stack">
              <p>
                {tr(
                  "This removes all cars from your garage. Your login account and consent history remain. NYC public records are not affected.",
                )}
              </p>

              <button
                className="primary-action"
                onClick={() =>
                  perform(async () => {
                    await api("garage", "DELETE");
                    setAccount(null);
                    setSheet(null);
                    await signOut();
                  }, tr("Your TicketSafe data was removed"))
                }
              >
                {tr("Delete my saved data")}
              </button>
              {
                <button
                  className="text-link"
                  onClick={() => {
                    setDeleteConfirmed(false);
                    setError("");
                    setSheet("delete-account");
                  }}
                >
                  {tr("Delete account")}
                </button>
              }
            </div>
          )}
          {sheet === "delete-account" && auth.user && (
            <div className="stack">
              <p>
                {tr(
                  "Permanently delete your login account, saved cars, preferences, and consent records. This cannot be undone. NYC public records and histories saved by other customers are not affected.",
                )}
              </p>
              <p className="small muted">
                {tr(
                  "After deletion, you can sign up again with the same email.",
                )}
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={deleteConfirmed}
                  onChange={(event) => setDeleteConfirmed(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  {tr(
                    "I understand that my account will be permanently deleted.",
                  )}
                </span>
              </label>
              {error && (
                <p className="notice error" role="alert">
                  {tr(error)}
                </p>
              )}
              <button
                className="primary-action"
                disabled={!deleteConfirmed || busy}
                onClick={() =>
                  perform(async () => {
                    await api("account", "DELETE", {
                      confirmation: "DELETE_ACCOUNT",
                    });
                    setAccount(null);
                    setResults(null);
                    setSelected(null);
                    setVehicleId("");
                    setMapVehicleId("");
                    setMapSelection("");
                    setSheet(null);
                    setView("garage");
                  }, tr("Your account was deleted. You can sign up again with the same email."))
                }
              >
                {busy && <LoaderCircle size={16} className="spin" />}
                {tr("Permanently delete account")}
              </button>
            </div>
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {tr(toast)}
        </div>
      )}
    </div>
  );
}
function VehicleData({ tickets }: { tickets: Violation[] }) {
  const { tr, locale } = usePreferences();
  const groups = new Map<
    string,
    {
      values: Violation["vehicle"];
      count: number;
    }
  >();
  for (const ticket of tickets) {
    const values = ticket.vehicle || {};
    if (!Object.values(values).some(Boolean)) continue;
    const key = JSON.stringify([
      values.make,
      values.year,
      values.color,
      values.body,
    ]);
    const previous = groups.get(key);
    groups.set(key, { values, count: (previous?.count || 0) + 1 });
  }
  return (
    <section
      className="vehicle-data"
      aria-label={tr("City-reported vehicle history")}
    >
      <h3>{tr("City-reported vehicle history")}</h3>
      <p className="small muted">
        {tr(
          "Attributes reported on tickets may describe previous vehicles using this plate.",
        )}
      </p>
      {groups.size ? (
        <div className="vehicle-history-list">
          {Array.from(groups.entries()).map(([key, { values, count }]) => (
            <div className="vehicle-history-row" key={key}>
              <div>
                {(["make", "year", "color", "body"] as const).map((field) => (
                  <span key={field}>
                    <small>{tr(field)}</small>
                    <strong>
                      {values[field]
                        ? tr(String(values[field]))
                        : tr("Not provided")}
                    </strong>
                  </span>
                ))}
              </div>
              <small>
                {count.toLocaleString(locale)} {tr("tickets")}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="small muted">
          {tr("No vehicle attributes were reported.")}
        </p>
      )}
    </section>
  );
}
function TicketList({
  tickets,
  onSelect,
  activeId,
  showPlate = false,
}: {
  tickets: any[];
  onSelect: (t: any) => void;
  activeId?: string;
  showPlate?: boolean;
}) {
  const { tr, locale, detailMode } = usePreferences();
  return (
    <div className="ticket-list">
      {tickets.map((t) => (
        <button
          className={"ticket " + (activeId === t.id ? "ticket-selected" : "")}
          aria-pressed={activeId === undefined ? undefined : activeId === t.id}
          key={t.id}
          onClick={() => onSelect(t)}
        >
          <div className={"ticket-symbol " + (t.due === 0 ? "resolved" : "")}>
            <Ticket size={18} />
          </div>
          <div className="ticket-main">
            <div className="ticket-reference">
              {showPlate && (
                <span className="ticket-plate-label">
                  {t.plate} · {t.state}
                </span>
              )}
              {detailMode === "geek" && (
                <>
                  <span className="mono">{t.id}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>{niceDate(t.issued, locale)}</span>
            </div>
            <h3>{tr(t.description)}</h3>
            <p>
              {t.location.label ? (
                <>
                  <MapPin size={10} />
                  <span>{t.location.label}</span>
                </>
              ) : (
                tr("Location not provided")
              )}
            </p>
          </div>
          <div className="ticket-cost">
            <div>
              <strong>{tr(money(t.due))}</strong>
              <p>
                {t.localStatus
                  ? tr("Marked ") + tr(t.localStatus)
                  : t.due === 0
                    ? tr("No balance")
                    : t.due == null
                      ? tr("Status unknown")
                      : tr("Outstanding")}
              </p>
            </div>
            <ChevronRight size={15} />
          </div>
        </button>
      ))}
    </div>
  );
}
function Modal({
  title,
  close,
  children,
  motion,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  motion?: "up";
}) {
  const { tr, locale, resolvedTheme } = usePreferences();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const last = document.activeElement as HTMLElement;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a,input,select,textarea,[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      last?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="sheet"
        data-motion={motion}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button
            className="round-control"
            onClick={close}
            aria-label={tr("Close")}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
