"use client";
import { usePreferences, PreferencesMenu } from "./preferences";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CarFront,
  Search,
  Map,
  SlidersHorizontal,
  Plus,
  ChevronRight,
  ArrowUpRight,
  Bell,
  MapPin,
  ShieldCheck,
  Building2,
  Ticket,
  Info,
  ArrowRight,
  X,
  Check,
  Download,
  LogIn,
  FileText,
  Mail,
  MessageSquare,
  ChevronDown,
  LoaderCircle,
  RefreshCw,
  ArrowLeft,
  Navigation,
  LockKeyhole,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import CityMap from "./city-map";
import { CityBackdrop } from "./city-backdrop";
import { TicketLocation } from "./ticket-location";
import { PlateBalance } from "./plate-balance";
import CustomSelect from "./custom-select";
import { useMapLocations } from "./use-map-locations";
import { hasPoint, contextRadius } from "@/lib/map-locations";
import { InstallGuide, PullToRefresh } from "./mobile-web-app";
import { PLATE_TYPES } from "@/lib/plate-types";
import { LEGAL_VERSION, OFFERS } from "@/lib/legal";
import {
  money,
  STATES,
  type Violation,
  type SearchResult,
  normalizePlate,
} from "@/lib/domain";
const nav = [
  { id: "garage", label: "Garage", icon: CarFront },
  { id: "search", label: "Search", icon: Search },
  { id: "map", label: "Map", icon: Map },
  { id: "account", label: "Account", icon: SlidersHorizontal },
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
const download = (name: string, text: string) => {
  const u = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
};
export default function Curbside() {
  const { tr, locale, resolvedTheme } = usePreferences();

  const [view, setView] = useState("garage"),
    [config, setConfig] = useState<any>({ services: {} }),
    [account, setAccount] = useState<any>(null),
    [clerk, setClerk] = useState<any>(null),
    [results, setResults] = useState<SearchResult | null>(null),
    [selected, setSelected] = useState<any>(null),
    [sheet, setSheet] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [plate, setPlate] = useState(""),
    [state, setState] = useState("NY"),
    [plateType, setPlateType] = useState(""),
    [history, setHistory] = useState(false),
    [filter, setFilter] = useState("all"),
    [caseData, setCaseData] = useState<any>(null),
    [offline, setOffline] = useState(false),
    [invite, setInvite] = useState(""),
    [vehicleId, setVehicleId] = useState("");
  const [purchase, setPurchase] = useState<string | null>(null);
  const [purchaseConsent, setPurchaseConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const purchaseResolve = useRef<((accepted: boolean) => void) | null>(null);
  const [mapSelection, setMapSelection] = useState("");
  const [mapFilter, setMapFilter] = useState("all");
  const [installGuideRequest, setInstallGuideRequest] = useState(0);
  const challenge = useRef("");
  const challengeEl = useRef<HTMLDivElement>(null);
  const notify = useCallback((s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 5000);
  }, []);
  const api = useCallback(
    async (path: string, method = "GET", body?: any) => {
      if (path === "checkout" && method === "POST") {
        setPurchaseConsent(false);
        setPurchase(body.kind);
        const accepted = await new Promise<boolean>((resolve) => {
          purchaseResolve.current = resolve;
        });
        if (!accepted)
          throw new Error(tr("Purchase canceled. You have not been charged."));
        body = { ...body, purchaseAccepted: true, legalVersion: LEGAL_VERSION };
      }
      const token = await clerk?.session?.getToken();
      const r = await fetch("/api/app/" + path, {
        method,
        headers: {
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
      });
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error || tr("Request unavailable"));
      return j;
    },
    [clerk],
  );
  const refresh = useCallback(async () => {
    if (!clerk?.user) return;
    try {
      setAccount(await api("me"));
    } catch (e) {
      notify((e as Error).message);
    }
  }, [api, clerk, notify]);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError(tr("Service configuration is unavailable.")));
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const q = new URLSearchParams(location.search);
    if (q.get("view")) setView(q.get("view")!);
    if (q.get("invite")) {
      setInvite(q.get("invite")!);
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
    const activePlate = plate.trim() || results?.plate?.plate || "";
    let sub = "NYC Ticket Monitoring";
    if (activePlate) {
      sub = `${activePlate.toUpperCase()} · NYC Tickets`;
    } else if (view === "map") {
      sub = "Live Map";
    } else if (view === "cases") {
      sub = "Disputes";
    } else if (view === "timeline") {
      sub = "Timeline";
    } else if (view === "account") {
      sub = "Settings";
    }
    document.title = `Curbside | ${sub}`;
  }, [plate, results?.plate?.plate, view]);
  useEffect(() => {
    if (!config.clerkKey) return;
    let disposed = false;
    let unsub: (() => void) | undefined;
    import("@clerk/clerk-js")
      .then(async ({ Clerk }) => {
        const c = new Clerk(config.clerkKey);
        await c.load();
        if (disposed) return;
        setClerk(c);
        unsub = c.addListener(({ user }: any) => {
          if (!user) setAccount(null);
          else
            c.session
              ?.getToken()
              .then((token: string | null) =>
                fetch("/api/app/me", {
                  headers: token ? { Authorization: "Bearer " + token } : {},
                }),
              )
              .then((r: Response) => r.json())
              .then((j: any) => {
                if (!j.error) setAccount(j);
              });
        });
      })
      .catch(() => notify(tr("Sign-in could not load. Try again shortly.")));
    return () => {
      disposed = true;
      unsub?.();
    };
  }, [config.clerkKey, notify]);
  useEffect(() => {
    if (!config.turnstileKey || !challengeEl.current) return;
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
  }, [config.turnstileKey, view, sheet]);
  const signIn = () => {
    if (clerk) clerk.openSignIn();
    else {
      setSheet("setup");
    }
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
  const search = useCallback(async (input: any) => {
    const p = normalizePlate(input);
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...p,
          history: input.history,
          locations: true,
          challenge: challenge.current,
        }),
      });
      const j: any = await r.json();
      if (!r.ok && !j.sources)
        throw new Error(j.error || tr("NYC sources are unavailable."));
      setResults(j);
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
      setBusy(false);
      challenge.current = "";
      (window as any).turnstile?.reset();
    }
  }, []);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "search_nyc_tickets",
          description: tr(
            "Search real NYC public violation datasets by plate and state and show the results. Does not save a vehicle or enable monitoring.",
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
  const activeVehicle =
    vehicles.find((v: any) => v.id === vehicleId) || vehicles[0];
  const garageTickets = (account?.tickets || []).filter(
    (t: any) => !activeVehicle || t.vehicleId === activeVehicle.id,
  );
  const tickets: Violation[] = results?.tickets || garageTickets;
  const locations = useMapLocations(
    tickets,
    config.mapboxToken,
    view === "map",
  );
  const mapTickets = locations.tickets.filter(
    (t) =>
      mapFilter === "all" ||
      (mapFilter === "open" ? t.due != null && t.due > 0 : !!t.location.label),
  );
  const mapTicket = mapTickets.find((t) => t.id === mapSelection);
  const selectMapTicket = useCallback(
    (t: Violation) => setMapSelection(t.id),
    [],
  );
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
          spellCheck={false}
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
      <label className="check-row">
        <input
          type="checkbox"
          checked={history}
          onChange={(e) => setHistory(e.target.checked)}
        />
        {tr("Include historical datasets back to FY2014")}
      </label>
      <div ref={challengeEl} />
      <button className="primary-action" disabled={busy || offline}>
        {busy ? (
          <LoaderCircle className="spin" size={19} />
        ) : (
          <Search size={18} />
        )}{" "}
        {busy ? tr("Checking NYC records…") : tr("Check my vehicle")}
        <ArrowRight size={18} />
      </button>
      {error && (
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
  const openDispute = async () => {
    if (!account) {
      signIn();
      return;
    }
    const v = vehicles.find(
      (v: any) => v.plate === selected.plate && v.state === selected.state,
    );
    if (!v) {
      notify(
        tr(
          "Save this vehicle and complete its first scan before opening a dispute.",
        ),
      );
      return;
    }
    await perform(async () => {
      const existing = account.cases?.find(
        (c: any) => c.summons === selected.id,
      );
      const c =
        existing ||
        (await api("cases", "POST", { vehicleId: v.id, summons: selected.id }));
      setCaseData(await api("cases/" + c.id));
      setSheet("dispute");
    });
  };
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
    }, tr("Vehicle saved. Monitoring starts after its complete initial scan."));
  };
  const go = (v: string) => {
    setView(v);
    setError("");
    setSheet(null);
  };
  return (
    <div
      className={
        "app " + (view === "garage" && !activeVehicle ? "onboarding" : "")
      }
    >
      <a className="skip-link" href="#main-content">
        {tr("Skip to content")}
      </a>
      <InstallGuide manualRequest={installGuideRequest} />
      <PullToRefresh
        disabled={busy || !!sheet || !!purchase}
        onRefresh={async () => {
          if (!navigator.onLine)
            throw new Error(tr("You’re offline. Connect to refresh."));
          const response = await fetch("/api/config", { cache: "no-store" });
          if (!response.ok)
            throw new Error(tr("Refresh unavailable. Try again."));
          setConfig(await response.json());
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
          if (clerk?.user) {
            setAccount(await api("me"));
          }
        }}
      />
      <div className="atlas">
        {view === "map" ? (
          <CityMap
            tickets={mapTickets}
            token={config.mapboxToken}
            onSelect={selectMapTicket}
            interactive
            selectedId={mapTicket?.id}
          />
        ) : (
          <CityBackdrop />
        )}
      </div>
      <div className="ambient-grain" />
      <header className="app-header">
        <button
          className="wordmark"
          onClick={() => go("garage")}
          aria-label={tr("Curbside home")}
        >
          <span className="curb-mark">
            <span />
            <span />
            <span />
          </span>
          curbside<span className="brand-period">.</span>
        </button>
        <nav className="desktop-nav" aria-label={tr("Primary navigation")}>
          {nav.map((n) => (
            <button
              className={view === n.id ? "active" : ""}
              key={n.id}
              onClick={() => go(n.id)}
            >
              <n.icon size={15} />
              {tr(n.label)}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <PreferencesMenu />
          <button
            className="round-control"
            onClick={() => go("account")}
            aria-label={tr("Account and notifications")}
          >
            {account ? <Bell size={19} /> : <LogIn size={19} />}
          </button>
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
                <span className="eyebrow">{tr("Less to keep track of.")}</span>
                <h1>
                  {tr("Your city.")}
                  <br />
                  {tr("Your car.")}
                  <br />
                  <span>{tr("Under control.")}</span>
                </h1>
                <p>
                  {tr("NYC tickets, a little clearer.")}
                  <br />
                  {tr("Check your plate. Know your next move.")}
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
              <button onClick={() => go("dealer")}>
                <Building2 size={15} />
                {tr("For dealerships")}
                <ArrowUpRight size={14} />
              </button>
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
                {vehicles.map((v: any) => (
                  <button
                    key={v.id}
                    className={activeVehicle.id === v.id ? "active" : ""}
                    onClick={() => setVehicleId(v.id)}
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
              <div className="eyebrow">
                {activeVehicle.state} /{" "}
                {activeVehicle.plate_type || tr("All plate types")}
              </div>
              <h1>{activeVehicle.plate}</h1>
              <div className="vehicle-subtitle">
                {activeVehicle.nickname}
                <span>·</span>
                {activeVehicle.checked_at
                  ? tr("Checked ") +
                    niceDate(
                      new Date(activeVehicle.checked_at).toISOString(),
                      locale,
                    )
                  : tr("Initial scan pending")}
              </div>
              <div className="scene-summary">
                <div>
                  <strong>
                    {money(
                      garageTickets.some((t: any) => t.due != null)
                        ? garageTickets.reduce(
                            (s: number, t: any) => s + (t.due || 0),
                            0,
                          )
                        : null,
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
                <button className="pill" onClick={() => setSheet("vehicle")}>
                  <SlidersHorizontal size={15} />
                  {tr("Vehicle settings")}
                </button>
              </div>
              <PlateBalance tickets={garageTickets} />
              <div className="glass activity-dock">
                <div className="section-heading">
                  <h2>{tr("Ticket activity")}</h2>
                  <span className="mono muted">
                    {garageTickets.length}
                    {tr("RECORDS")}
                  </span>
                </div>
                {garageTickets.length ? (
                  <TicketList
                    tickets={garageTickets.slice(0, 5)}
                    onSelect={openTicket}
                  />
                ) : (
                  <p className="small muted">
                    {tr(
                      "No records saved yet. A complete source scan establishes your baseline before new-ticket alerts begin.",
                    )}
                  </p>
                )}
                <div className="dock-footer">
                  <Info size={13} />
                  {config.services.monitoring
                    ? tr("Checks use available city records.")
                    : tr("Automatic monitoring awaits service setup.")}
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
                      {results.tickets.length}
                      {tr("records · Checked")}{" "}
                      {new Date(results.checkedAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      <br />
                      {results.query.plateType
                        ? tr("Plate type matched exactly.")
                        : tr(
                            "Plate type not specified. Results may include different vehicle histories.",
                          )}
                    </div>
                    {!results.complete && (
                      <div className="notice warning">
                        {results.unavailable
                          ? tr("NYC sources did not respond. Please try again.")
                          : tr(
                              "Some sources are unavailable or reached a result limit. These results are incomplete.",
                            )}
                      </div>
                    )}
                    <PlateBalance
                      tickets={results.tickets}
                      complete={results.complete}
                    />
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
                              : tr("Checked ") + niceDate(s.checkedAt, locale)}
                          </small>
                        </div>
                      ))}
                    </details>
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
              <p>
                {mapTickets.filter((t) => hasPoint(t.location)).length}{" "}
                {tr("on the map ·")}{" "}
                {mapTickets.filter((t) => !!t.location.label).length}
                {tr("with an address")}
              </p>
            </div>
            <div
              className={
                "glass map-results" + (mapTicket ? " map-results-compact" : "")
              }
              tabIndex={0}
              aria-label={
                mapTicket ? tr("Selected ticket") : tr("Ticket locations")
              }
            >
              {!mapTicket && (
                <>
                  <div className="section-heading">
                    <h2>{tr("Locations")}</h2>
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
                  </div>
                  <p className="map-helper">
                    {tr(
                      "Addresses work too. Select a ticket to explore its location.",
                    )}
                  </p>
                  {!!tickets.length && (
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
                </>
              )}
              {mapTicket && (
                <div className="map-selection" aria-live="polite">
                  <div className="row spread">
                    <span className="eyebrow">
                      {hasPoint(mapTicket.location)
                        ? tr(mapTicket.location.precision) + tr(" location")
                        : tr("Address on record")}
                    </span>
                    <button
                      aria-label={tr("Show all tickets")}
                      className="text-link"
                      onClick={() => setMapSelection("")}
                    >
                      {tr("All tickets")}
                      <X size={14} />
                    </button>
                  </div>
                  <h3>
                    {mapTicket.location.label || tr("Location not provided")}
                  </h3>
                  <p>
                    {mapTicket.description} ·{" "}
                    {niceDate(mapTicket.issued, locale)}
                  </p>
                  <div className="selected-ticket-amount">
                    <strong>{money(mapTicket.due)}</strong>
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
                  <button
                    className="button primary"
                    onClick={() => openTicket(mapTicket)}
                  >
                    {tr("View violation")}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              {!mapTicket && (
                <>
                  {mapTickets.length ? (
                    <TicketList
                      tickets={mapTickets}
                      onSelect={selectMapTicket}
                    />
                  ) : (
                    <div className="empty">
                      <MapPin size={27} />
                      <h2>
                        {tickets.length
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
                  <div className="dock-footer">
                    {tr(
                      "City addresses stay visible even without a map match. Approximate matches are labeled; no precise pin is invented.",
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
        {view === "account" && (
          <section className="content-page view-enter">
            <div className="page-heading">
              <span className="eyebrow">{tr("Your preferences")}</span>
              <h1>{tr("Account preferences")}</h1>
              <p>{tr("Choose how Curbside keeps you in the loop.")}</p>
            </div>
            {invite && (
              <div className="notice" style={{ marginBottom: 20 }}>
                {tr("You have a dealership sponsorship invitation.")}{" "}
                {account ? (
                  <button
                    className="text-link"
                    onClick={() =>
                      perform(async () => {
                        await api("enroll", "POST", { token: invite });
                        setInvite("");
                        await refresh();
                      }, tr("Sponsorship activated"))
                    }
                  >
                    {tr("Activate my benefit →")}
                  </button>
                ) : (
                  <button className="text-link" onClick={signIn}>
                    {tr("Sign in to activate →")}
                  </button>
                )}
              </div>
            )}
            <div className="account-layout">
              <div className="glass form-card stack">
                <div className="row spread">
                  <h2>
                    {account
                      ? tr("Your account")
                      : tr("Keep your vehicle in view.")}
                  </h2>
                  <ShieldCheck size={21} />
                </div>
                {!account ? (
                  <>
                    <p className="small muted">
                      {tr(
                        "Save a vehicle to monitor new records. Verify your email before enabling alerts.",
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
                        {tr(account.user.plan)}
                        {tr("plan")}
                      </span>
                    </p>
                    {account.user.role === "partner" && (
                      <button className="button" onClick={() => go("partner")}>
                        {tr("Open assigned cases")}
                      </button>
                    )}
                    <Settings
                      account={account}
                      api={api}
                      refresh={refresh}
                      perform={perform}
                      services={config.services}
                    />
                    <button
                      className="button ghost"
                      onClick={() => clerk?.signOut()}
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
                          "Remove monitoring and saved records. Active partner cases must be resolved first.",
                        )}
                      </p>
                      <button
                        className="text-link"
                        onClick={() => setSheet("delete")}
                      >
                        {tr("Delete my Curbside data")}
                      </button>
                    </details>
                  </>
                )}
                <a className="text-link" href="/legal/privacy">
                  {tr("Privacy & data sources")}
                  <ArrowUpRight size={13} />
                </a>
                <button
                  className="text-link"
                  onClick={() => setInstallGuideRequest((n) => n + 1)}
                >
                  {tr("Add Curbside to your Home Screen")}
                  <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="glass form-card">
                <div className="eyebrow">Curbside Plus</div>
                <div className="price">
                  $4.99<span>{tr("/ month")}</span>
                </div>
                <p className="small muted">{tr("Or $39 for the year.")}</p>
                <ul className="benefits">
                  <li>
                    <Check size={15} />
                    {tr("Three monitored vehicles")}
                  </li>
                  <li>
                    <Check size={15} />
                    {tr("Email alerts and reminders")}
                  </li>
                  <li>
                    <Check size={15} />
                    {tr("10 SMS segments each month")}
                  </li>
                  <li>
                    <Check size={15} />
                    {tr("No ads. No sale of vehicle data.")}
                  </li>
                </ul>
                <button
                  className="primary-action"
                  onClick={() =>
                    account
                      ? perform(async () => {
                          location.href = (
                            await api("checkout", "POST", { kind: "plus" })
                          ).url;
                        })
                      : signIn()
                  }
                >
                  {tr("Choose monthly")}
                  <ArrowRight size={16} />
                </button>
                <button
                  className="text-link"
                  onClick={() =>
                    account
                      ? perform(async () => {
                          location.href = (
                            await api("checkout", "POST", { kind: "plus-year" })
                          ).url;
                        })
                      : signIn()
                  }
                >
                  {tr("Choose annual · $39")}
                </button>
                {!config.services.billing && (
                  <p className="small muted">
                    {tr("Subscriptions will open when billing is activated.")}
                  </p>
                )}
                <div className="plan-note">
                  <span className="eyebrow">{tr("Always free")}</span>
                  <p>
                    {tr(
                      "Plate searches, one monitored vehicle, email alerts, and maps.",
                    )}
                  </p>
                </div>
              </div>
            </div>
            {account?.cases?.length > 0 && (
              <div className="glass form-card" style={{ marginTop: 20 }}>
                <h2>{tr("Your dispute cases")}</h2>
                {account.cases.map((c: any) => (
                  <button
                    className="setting"
                    style={{ width: "100%" }}
                    key={c.id}
                    onClick={() =>
                      perform(async () => {
                        setCaseData(await api("cases/" + c.id));
                        setSheet("dispute");
                      })
                    }
                  >
                    <span>{c.summons}</span>
                    <span className="badge">{tr(c.status)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {view === "partner" && (
          <section className="content-page view-enter">
            <div className="page-heading">
              <span className="eyebrow">{tr("Partner workspace")}</span>
              <h1>
                {tr("Every case.")}
                <br />
                <span>{tr("Accounted for.")}</span>
              </h1>
            </div>
            <Partner api={api} perform={perform} />
          </section>
        )}
        {view === "dealer" && (
          <section className="content-page view-enter">
            <div className="page-heading">
              <span className="eyebrow">
                {tr("Curbside / For dealerships")}
              </span>
              <h1>{tr("For dealerships")}</h1>
              <p>
                {tr("A private ticket-monitoring benefit for your customers.")}
              </p>
            </div>
            <Dealer
              account={account}
              api={api}
              perform={perform}
              signIn={signIn}
            />
          </section>
        )}
        <footer className="page-footer">
          <span>{tr("Independent service. Not affiliated with NYC.")}</span>
          <button onClick={() => go("dealer")}>
            {tr("For dealerships")}
            <ArrowUpRight size={11} />
          </button>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label={tr("Mobile navigation")}>
        {nav.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? "active" : ""}
            onClick={() => go(n.id)}
          >
            <n.icon size={21} />
            <span>{tr(n.label)}</span>
          </button>
        ))}
      </nav>
      {account && !account.user.legalAccepted && (
        <Modal title={tr("A clear agreement")} close={() => clerk?.signOut()}>
          <div className="stack">
            <p className="small muted">
              {tr(
                "Before saving vehicles or using account services, please review the current terms. SMS and purchases each have a separate consent.",
              )}
            </p>
            <p className="consent-links">
              <a href="/legal/terms" target="_blank" rel="noreferrer">
                {tr("Read Terms of service")}
              </a>{" "}
              ·{" "}
              <a href="/legal/privacy" target="_blank" rel="noreferrer">
                {tr("Read Privacy policy")}
              </a>
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={termsConsent}
                onChange={(e) => setTermsConsent(e.target.checked)}
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
            <p className="small muted">
              {tr(
                "You can cancel existing billing or stop alerts without accepting new terms.",
              )}
            </p>
            <button
              className="button"
              onClick={() =>
                perform(async () => {
                  location.href = (await api("billing", "POST", {})).url;
                })
              }
            >
              {tr("Manage existing billing")}
            </button>
            <button
              className="text-link"
              onClick={() =>
                perform(async () => {
                  await api("sms-stop", "POST", {});
                  await api("settings", "PATCH", {
                    emailAlerts: false,
                    timezone: account.user.timezone,
                  });
                  await refresh();
                }, tr("Service alerts stopped"))
              }
            >
              {tr("Stop service alerts")}
            </button>
            <a className="consent-links" href="mailto:ezrefillyny@gmail.com">
              {tr("Contact support for account or privacy help")}
            </a>
          </div>
        </Modal>
      )}
      {purchase && OFFERS[purchase] && (
        <Modal
          title={tr("Review your purchase")}
          close={() => {
            purchaseResolve.current?.(false);
            setPurchase(null);
          }}
        >
          <div className="stack">
            <div className="eyebrow">{tr(OFFERS[purchase].name)}</div>
            <h2>{tr(OFFERS[purchase].price)}</h2>
            <p className="small">{tr(OFFERS[purchase].includes)}</p>
            <div className="notice">{tr(OFFERS[purchase].renewal)}</div>
            <p className="consent-links">
              <a href="/legal/billing" target="_blank" rel="noreferrer">
                {tr("Billing, refunds & cancellation")}
              </a>{" "}
              ·{" "}
              <a href="/legal/terms" target="_blank" rel="noreferrer">
                {tr("Terms")}
              </a>
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={purchaseConsent}
                onChange={(e) => setPurchaseConsent(e.target.checked)}
              />
              <span>
                {purchase === "ai"
                  ? tr("I agree to this one-time purchase and the terms above.")
                  : tr(
                      "I agree to the recurring price, renewal schedule, and cancellation terms above.",
                    )}
              </span>
            </label>
            <button
              className="primary-action"
              disabled={!purchaseConsent || !config.services.billing}
              onClick={() => {
                purchaseResolve.current?.(true);
                setPurchase(null);
              }}
            >
              {tr("Continue to secure checkout")}
              <ArrowRight size={16} />
            </button>
            {!config.services.billing && (
              <p className="small muted">
                {tr("Paid services are not open yet. No charge can be made.")}
              </p>
            )}
          </div>
        </Modal>
      )}
      {sheet && !purchase && !(account && !account.user.legalAccepted) && (
        <Modal
          title={
            sheet === "ticket"
              ? tr("Violation details")
              : sheet === "save"
                ? tr("Add to your garage")
                : sheet === "dispute"
                  ? tr("Your dispute workspace")
                  : sheet === "vehicle"
                    ? tr("Vehicle settings")
                    : sheet === "privacy"
                      ? tr("Your data. Your control.")
                      : sheet === "delete"
                        ? tr("Delete saved data?")
                        : tr("Account activation")
          }
          close={() => setSheet(null)}
        >
          {sheet === "setup" && (
            <div className="stack">
              <LockKeyhole size={28} />
              <p>{tr("Account sign-in hasn’t been activated yet.")}</p>
              <p className="small muted">
                {tr(
                  "You can search real NYC records now. Saving vehicles, alerts, and purchases become available after the service owner connects account and delivery providers.",
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
                  "Saved vehicles, notification preferences, and dispute evidence are private to your account. Dealerships see sponsorship enrollment and billing, not ticket locations or evidence. A filing partner can access only the case you authorize.",
                )}
              </p>
              <p>
                {tr(
                  "Service messages and marketing permissions are separate. Stop SMS with STOP and unsubscribe from email using the message link. Deleting a saved vehicle stops its monitoring.",
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
                  "Uploaded evidence is private and only available through short-lived, authorized access. No payment or hearing request is submitted without an explicit action.",
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
                {tr("I own or am authorized to monitor this vehicle.")}
              </label>
              <p className="small muted">
                {tr(
                  "Your first complete scan creates one existing-ticket summary. Later discoveries are notified separately.",
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
                {tr("Monitoring since")}{" "}
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
                      monitoring: f.get("monitoring") === "on",
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
                <label className="check-row">
                  <input
                    type="checkbox"
                    name="monitoring"
                    defaultChecked={!!activeVehicle.monitoring}
                  />
                  {tr("Monitor this vehicle")}
                </label>
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
                {tr("Remove vehicle and stop monitoring")}
              </button>
            </div>
          )}
          {sheet === "ticket" && selected && (
            <div className="stack">
              <div className="ticket-detail-title">
                <span className="eyebrow">
                  {selected.plate} / {selected.state}
                </span>
                <h2>{selected.description}</h2>
                <strong>{money(selected.due)}</strong>
                <span className="muted small">{tr("Reported amount due")}</span>
              </div>
              <div className="notice">
                {selected.localStatus
                  ? tr("Marked ") +
                    selected.localStatus +
                    tr(" by you. City confirmation may still be pending.")
                  : selected.status === "Unknown"
                    ? tr(
                        "Historical issuance record. Current payment status is unknown.",
                      )
                    : tr(selected.status)}
              </div>
              <TicketLocation
                key={selected.id}
                ticket={selected}
                token={config.mapboxToken}
                onOpen={(ticket) => {
                  setMapSelection(ticket.id);
                  setMapFilter("all");
                  setSheet(null);
                  setView("map");
                }}
              />
              <dl className="detail-grid">
                {[
                  [tr("Summons"), selected.id],
                  [tr("Violation code"), selected.code],
                  [tr("Issue date"), niceDate(selected.issued, locale)],
                  [tr("Time"), selected.time],
                  [tr("Issuing agency"), selected.agency],
                  [tr("Location"), selected.location.label],
                  [tr("Location precision"), selected.location.precision],
                  ...(selected.location.resolvedBy
                    ? [[tr("Location lookup"), selected.location.resolvedBy]]
                    : []),
                  [tr("Checked"), niceDate(selected.checkedAt, locale)],
                  [
                    tr("Action date"),
                    selected.actionDate
                      ? niceDate(selected.actionDate, locale) +
                        " (" +
                        tr(selected.deadlineBasis) +
                        tr(" + 30 days)")
                      : tr("Confirm from official notice"),
                  ],
                  [
                    tr("City-reported vehicle"),
                    Object.values(selected.vehicle || {}).join(" · "),
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v ? tr(String(v)) : tr("Not provided")}</dd>
                  </div>
                ))}
              </dl>
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
                    <span>{money(v as number)}</span>
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
                {tr("Pay or review with NYC")}
                <ArrowUpRight size={17} />
              </a>
              {account && (
                <div className="row">
                  {["paid", "submitted"].map((status) => (
                    <button
                      className="button ghost"
                      key={tr(status)}
                      onClick={() =>
                        perform(async () => {
                          const v = vehicles.find(
                            (v: any) =>
                              v.plate === selected.plate &&
                              v.state === selected.state,
                          );
                          if (!v)
                            throw new Error(
                              tr(
                                "Save this vehicle before changing its reminder status.",
                              ),
                            );
                          await api("tickets/" + selected.id, "PATCH", {
                            vehicleId: v.id,
                            status,
                          });
                          setSelected({ ...selected, localStatus: status });
                          await refresh();
                        }, tr("Reminders stopped; city confirmation pending"))
                      }
                    >
                      {tr("Mark")}
                      {tr(status)}
                    </button>
                  ))}
                </div>
              )}
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
              </details>
              <p className="small muted">
                {tr(
                  "Review the official notice for deadlines. Missing a record or a balance does not establish dismissal.",
                )}
              </p>
            </div>
          )}
          {sheet === "dispute" && caseData && (
            <Dispute
              data={caseData}
              setData={setCaseData}
              api={api}
              perform={perform}
              services={config.services}
            />
          )}
          {sheet === "delete" && (
            <div className="stack">
              <p>
                {tr(
                  "This removes your saved vehicles, preferences, and eligible dispute records. It does not delete NYC public records or automatically cancel a paid subscription.",
                )}
              </p>
              <button
                className="button"
                onClick={() =>
                  perform(async () => {
                    location.href = (await api("billing", "POST", {})).url;
                  })
                }
              >
                {tr("Manage subscription first")}
              </button>
              <button
                className="primary-action"
                onClick={() =>
                  perform(async () => {
                    await api("account", "DELETE");
                    setAccount(null);
                    setSheet(null);
                    await clerk?.signOut();
                  }, tr("Your Curbside data was removed"))
                }
              >
                {tr("Delete my saved data")}
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
function TicketList({
  tickets,
  onSelect,
  activeId,
}: {
  tickets: any[];
  onSelect: (t: any) => void;
  activeId?: string;
}) {
  const { tr, locale, resolvedTheme } = usePreferences();

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
            <h3>{t.description}</h3>
            <p>
              {t.location.label ? (
                <>
                  <MapPin size={10} />
                  {t.location.label}
                </>
              ) : (
                tr("Location not provided")
              )}
              <span>· {niceDate(t.issued, locale)}</span>
            </p>
          </div>
          <div className="ticket-cost">
            <div>
              <strong>{money(t.due)}</strong>
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
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
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
function Settings({ account, api, refresh, perform, services }: any) {
  const { tr, locale, resolvedTheme } = usePreferences();

  const [email, setEmail] = useState(account.user.emailAlerts),
    [timezone, setTimezone] = useState(account.user.timezone),
    [phone, setPhone] = useState(account.user.phone || ""),
    [consent, setConsent] = useState(false),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <div className="stack">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          perform(async () => {
            await api("settings", "PATCH", { emailAlerts: email, timezone });
            await refresh();
          }, tr("Preferences saved"));
        }}
      >
        <label className="check-row">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
          />
          {tr("Email me new-ticket summaries and reminders.")}
        </label>
        <label className="field">
          {tr("Timezone")}
          <CustomSelect
            value={timezone}
            onChange={setTimezone}
            label={tr("Timezone")}
            options={[
              { value: "America/New_York", label: tr("Eastern time") },
              { value: "America/Chicago", label: tr("Central time") },
              { value: "America/Denver", label: tr("Mountain time") },
              { value: "America/Phoenix", label: tr("Arizona time") },
              { value: "America/Los_Angeles", label: tr("Pacific time") },
              { value: "America/Anchorage", label: tr("Alaska time") },
              { value: "Pacific/Honolulu", label: tr("Hawaii time") },
            ]}
          />
        </label>
        <p className="small muted">
          {tr(
            "Quiet hours: 9 p.m.–8 a.m. Reminders are scheduled only when the ticket has a supported action date.",
          )}
        </p>
        <button className="button">{tr("Save preferences")}</button>
      </form>
      <details>
        <summary>{tr("SMS alerts")}</summary>
        {account.user.smsConsent ? (
          <>
            <p className="small">
              {tr("Verified:")}
              {account.user.phone}
            </p>
            <button
              className="text-link"
              onClick={() =>
                perform(async () => {
                  await api("sms-stop", "POST", {});
                  await refresh();
                }, tr("SMS alerts stopped"))
              }
            >
              {tr("Stop SMS alerts")}
            </button>
          </>
        ) : (
          <div className="stack" style={{ marginTop: 15 }}>
            <label className="field">
              {tr("US phone number")}
              <input
                type="tel"
                placeholder="+12125550123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {tr(
                "I agree to receive automated ticket alerts from Curbside. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.",
              )}
            </label>
            <p className="consent-links">
              <a href="/legal/messaging" target="_blank" rel="noreferrer">
                {tr("Messaging terms")}
              </a>{" "}
              ·{" "}
              <a href="/legal/privacy" target="_blank" rel="noreferrer">
                {tr("Privacy policy")}
              </a>
            </p>
            <button
              className="button"
              disabled={!services.sms}
              onClick={() =>
                perform(async () => {
                  await api("phone", "POST", { phone, consent });
                  setSent(true);
                }, tr("Verification code sent"))
              }
            >
              {tr("Send verification code")}
            </button>
            {!services.sms && (
              <p className="small muted">
                {tr("SMS provider setup is pending.")}
              </p>
            )}
            {sent && (
              <>
                <input
                  aria-label={tr("Verification code")}
                  inputMode="numeric"
                  placeholder={tr("Verification code")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  className="button"
                  onClick={() =>
                    perform(async () => {
                      await api("phone-confirm", "POST", { code });
                      await refresh();
                    }, tr("Phone verified"))
                  }
                >
                  {tr("Verify phone")}
                </button>
              </>
            )}
          </div>
        )}
      </details>
      <button
        className="text-link"
        onClick={() =>
          perform(async () => {
            location.href = (await api("billing", "POST", {})).url;
          })
        }
      >
        {tr("Manage billing")}
        <ArrowUpRight size={13} />
      </button>
    </div>
  );
}
function Dealer({ account, api, perform, signIn }: any) {
  const { tr, locale, resolvedTheme } = usePreferences();

  const [data, setData] = useState<any>(null),
    [url, setUrl] = useState("");
  useEffect(() => {
    if (account)
      api("dealer")
        .then(setData)
        .catch(() => {});
  }, [account, api]);
  return (
    <div className="account-layout">
      <div className="glass form-card stack">
        <Building2 size={28} />
        <h2>{data?.dealer.name || tr("A thoughtful handoff.")}</h2>
        <p className="small muted">
          {tr(
            "Give your customers a year of ticket monitoring. They manage their own vehicles; their ticket history and locations stay private.",
          )}
        </p>
        {!account ? (
          <button className="primary-action" onClick={signIn}>
            {tr("Set up your dealership")}
            <ArrowRight size={16} />
          </button>
        ) : !data ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              perform(async () => {
                await api("dealer", "POST", f);
                setData(await api("dealer"));
              }, tr("Dealership created"));
            }}
          >
            <label className="field">
              {tr("Dealership name")}
              <input name="name" required />
            </label>
            <label className="field">
              {tr("URL name")}
              <input
                name="slug"
                pattern="[a-z][a-z0-9-]{2,40}"
                placeholder="your-dealership"
                required
              />
            </label>
            <button className="primary-action">
              {tr("Create dealership")}
              <Plus size={16} />
            </button>
          </form>
        ) : (
          <>
            <div className="row spread">
              <span className="badge">
                {data.dealer.active
                  ? tr("Active sponsorship")
                  : tr("Billing not active")}
              </span>
              <strong>
                {data.enrollments.length}
                {tr("enrolled")}
              </strong>
            </div>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                perform(async () => {
                  await api("dealer/branding", "PATCH", f);
                  setData(await api("dealer"));
                }, tr("Branding updated"));
              }}
            >
              <label className="field">
                {tr("Display name")}
                <input name="name" defaultValue={data.dealer.name} />
              </label>
              <label className="field">
                {tr("Brand color")}
                <input
                  name="color"
                  type="color"
                  defaultValue={data.dealer.color}
                />
              </label>
              <button className="button">{tr("Save branding")}</button>
            </form>
            <button
              className="primary-action"
              onClick={() =>
                perform(async () => {
                  setUrl((await api("dealer/invite", "POST", {})).url);
                })
              }
            >
              {tr("Create customer invitation")}
              <Plus size={16} />
            </button>
            {url && (
              <label className="field">
                {tr("Share this private activation link")}
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  className="button"
                  onClick={() => navigator.clipboard.writeText(url)}
                >
                  {tr("Copy link")}
                </button>
              </label>
            )}
            <p className="small muted">
              {tr(
                "Links expire after 30 days and can be claimed once. Customers consent to alerts themselves.",
              )}
            </p>
            <div className="source-details">
              {data.enrollments.map((e: any) => (
                <div key={e.id}>
                  <span>
                    {tr("Customer")}
                    {e.id.slice(0, 8)}
                  </span>
                  <span>
                    {tr("Expires")}
                    {niceDate(new Date(e.expires_at).toISOString(), locale)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="glass form-card">
        <span className="eyebrow">{tr("Dealer-sponsored access")}</span>
        <div className="price">
          $149<span>{tr("/ month")}</span>
        </div>
        <ul className="benefits">
          <li>
            <Check size={15} />
            {tr("100 active sponsored customers")}
          </li>
          <li>
            <Check size={15} />
            {tr("Your dealership branding")}
          </li>
          <li>
            <Check size={15} />
            {tr("One vehicle per customer")}
          </li>
          <li>
            <Check size={15} />
            {tr("Email + 10 SMS segments per month")}
          </li>
          <li>
            <Check size={15} />
            {tr("12-month customer sponsorships")}
          </li>
        </ul>
        <p className="small muted capacity-note">
          {tr(
            "Additional capacity: $1 per active customer per month, enabled through an agreed billing adjustment.",
          )}
        </p>
        <button
          className="primary-action"
          onClick={() =>
            account
              ? perform(async () => {
                  location.href = (
                    await api("checkout", "POST", { kind: "dealer" })
                  ).url;
                })
              : signIn()
          }
        >
          {tr("Activate dealer plan")}
          <ArrowRight size={16} />
        </button>
        <div className="plan-note">
          <LockKeyhole size={19} />
          <p>
            {tr(
              "Enrollment and billing are visible to you. Tickets, locations, and evidence are visible to the customer.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
function Dispute({ data, setData, api, perform, services }: any) {
  const { tr, locale, resolvedTheme } = usePreferences();

  const [facts, setFacts] = useState(data.facts),
    [draft, setDraft] = useState(data.draft),
    [confirmed, setConfirmed] = useState(false);
  const load = async () => setData(await api("cases/" + data.id));
  return (
    <div className="stack">
      <div className="row spread">
        <span className="mono">{data.summons}</span>
        <span className="badge">{tr(data.status)}</span>
      </div>
      <div className="notice">
        {tr(
          "Prepare your case here. Nothing is filed until an eligible partner submits it and provides an official receipt.",
        )}
      </div>
      <details open>
        <summary>{tr("1. Gather your evidence")}</summary>
        <ul className="benefits">
          <li>
            <Check size={14} />
            {tr("Your ticket or Notice of Liability")}
          </li>
          <li>
            <Check size={14} />
            {tr("Clear photos of relevant signs and surroundings")}
          </li>
          <li>
            <Check size={14} />
            {tr("Receipts, permits, or other supporting records")}
          </li>
        </ul>
        <label className="field">
          {tr("Upload evidence · PDF, JPEG, PNG")}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const b = new FormData();
              b.append("file", f);
              perform(async () => {
                await api("cases/" + data.id + "/evidence", "POST", b);
                await load();
              }, tr("Evidence added; review is required again"));
            }}
          />
        </label>
        <p className="small muted">
          {tr(
            "Up to 10 files, 10 MB each, 20 MB total. AI drafting uses your written facts; it does not inspect these attachments.",
          )}
        </p>
        {data.evidence?.map((e: any) => (
          <a
            className="text-link"
            key={e.id}
            href={e.url}
            target="_blank"
            rel="noreferrer"
          >
            {e.name}
            <ArrowUpRight size={12} />
          </a>
        ))}
      </details>
      <label className="field">
        {tr("2. What happened? Confirmed facts only.")}
        <textarea
          value={facts}
          onChange={(e) => setFacts(e.target.value)}
          maxLength={6000}
          placeholder={tr(
            "Describe what happened, why you believe the ticket is incorrect, and the evidence you have.",
          )}
        />
      </label>
      {data.paid ? (
        <button
          className="button"
          disabled={!services.ai || data.generations >= 3}
          onClick={() =>
            perform(async () => {
              const d = await api("cases/" + data.id + "/generate", "POST", {
                facts,
              });
              setData(d);
              setDraft(d.draft);
            }, tr("Draft ready for your review"))
          }
        >
          {tr("Generate reviewed-facts draft ·")}
          {3 - data.generations}
          {tr("remaining")}
        </button>
      ) : (
        <button
          className="button"
          disabled={!services.ai}
          onClick={() =>
            perform(async () => {
              location.href = (
                await api("checkout", "POST", { kind: "ai", caseId: data.id })
              ).url;
            })
          }
        >
          {tr("AI preparation · $9 per case")}
        </button>
      )}
      {!services.ai && (
        <p className="small muted">
          {tr(
            "AI preparation is awaiting activation. You can write and export your own statement below.",
          )}
        </p>
      )}
      <label className="field">
        {tr("3. Your statement")}
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setConfirmed(false);
          }}
          rows={10}
          maxLength={15000}
        />
      </label>
      <button
        className="button"
        onClick={() =>
          perform(async () => {
            await api("cases/" + data.id, "PATCH", { facts, draft });
            await load();
          }, tr("Statement saved; review this version before approval"))
        }
      >
        {tr("Save statement")}
      </button>
      <label className="check-row">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {tr(
          "I reviewed this statement and all attachments. The facts are accurate, and I understand that no hearing has been requested yet.",
        )}
      </label>
      <button
        className="primary-action"
        disabled={!confirmed || draft !== data.draft}
        onClick={() =>
          perform(async () => {
            await api("cases/" + data.id + "/approve", "POST", {
              confirmed,
              version: data.version,
            });
            await load();
          }, tr("Current version approved"))
        }
      >
        {tr("Approve version")}
        {data.version} <Check size={16} />
      </button>
      <button
        className="button"
        onClick={() =>
          download(
            "curbside-dispute-" + data.summons + ".txt",
            tr("Summons: ") +
              data.summons +
              tr("\nStatus: ") +
              data.status +
              "\n\n" +
              draft +
              tr("\n\nEvidence: ") +
              (data.evidence || []).map((e: any) => e.name).join(", ") +
              tr(
                "\n\nPrepared for customer review. This document is not a filing receipt.",
              ),
          )
        }
      >
        <Download size={15} />
        {tr("Export statement")}
      </button>
      <a
        className="button"
        href="https://www.nyc.gov/site/finance/vehicles/dispute-web.page"
        target="_blank"
        rel="noreferrer"
      >
        {tr("Submit directly with NYC")}
        <ArrowUpRight size={14} />
      </a>
      <button
        className="button ghost"
        disabled={data.status !== "approved"}
        onClick={() =>
          perform(async () => {
            const r = await api("cases/" + data.id + "/handoff", "POST", {
              authorized: true,
            });
            await load();
            if (r.instructions) alert(r.instructions);
          })
        }
      >
        {tr("Request partner filing")}
      </button>
      <p className="small muted">
        {tr(
          "Partner filing is unavailable until an eligible partner is onboarded. A request is not a submission. Official receipt:",
        )}{" "}
        {data.filing_reference || tr("Not received")}.
      </p>
    </div>
  );
}

function Partner({ api, perform }: any) {
  const { tr, locale, resolvedTheme } = usePreferences();

  const [cases, setCases] = useState<any[]>([]),
    [current, setCurrent] = useState<any>(null),
    [receipt, setReceipt] = useState("");
  useEffect(() => {
    api("partner")
      .then((r: any) => setCases(r.cases))
      .catch(() => {});
  }, [api]);
  const load = async (id: string) => setCurrent(await api("cases/" + id));
  return (
    <div className="account-layout">
      <div className="glass form-card stack">
        <h2>{tr("Assigned cases")}</h2>
        <p className="small muted">
          {tr(
            "Only cases explicitly assigned to your partner account appear here.",
          )}
        </p>
        {cases.length ? (
          cases.map((c) => (
            <button
              key={c.id}
              className="setting"
              onClick={() => perform(() => load(c.id))}
            >
              <span>{c.summons}</span>
              <span className="badge">{tr(c.status)}</span>
            </button>
          ))
        ) : (
          <p className="small muted">{tr("No cases assigned.")}</p>
        )}
      </div>
      {current && (
        <div className="glass form-card stack">
          <div className="row spread">
            <h2>{current.summons}</h2>
            <span className="badge">{tr(current.status)}</span>
          </div>
          <pre className="draft">{current.draft}</pre>
          {current.evidence?.map((e: any) => (
            <a
              key={e.id}
              className="text-link"
              href={e.url}
              target="_blank"
              rel="noreferrer"
            >
              {e.name} ↗
            </a>
          ))}
          <button
            className="button"
            onClick={() =>
              download("case-" + current.summons + ".txt", current.draft)
            }
          >
            {tr("Export statement")}
          </button>
          {current.status === "awaiting authorization" && (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                perform(async () => {
                  await api("partner/" + current.id, "PATCH", {
                    status: "accepted",
                    authorizationVerified: true,
                  });
                  await load(current.id);
                }, tr("Case accepted"));
              }}
            >
              <label className="check-row">
                <input type="checkbox" required />
                {tr(
                  "I verified the customer’s required authorization under the partner agreement.",
                )}
              </label>
              <button className="primary-action">{tr("Accept case")}</button>
            </form>
          )}
          {current.status === "accepted" && (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                perform(async () => {
                  await api("partner/" + current.id, "PATCH", {
                    status: "filed",
                    receiptEvidenceId: receipt,
                    filingReference: f.get("reference"),
                  });
                  await load(current.id);
                }, tr("Official filing recorded"));
              }}
            >
              <label className="field">
                {tr("Official filing receipt")}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const b = new FormData();
                    b.append("file", f);
                    perform(async () => {
                      setReceipt(
                        (
                          await api(
                            "partner/" + current.id + "/receipt",
                            "POST",
                            b,
                          )
                        ).id,
                      );
                    }, tr("Receipt uploaded"));
                  }}
                />
              </label>
              <label className="field">
                {tr("Official confirmation reference")}
                <input name="reference" required />
              </label>
              <button className="primary-action" disabled={!receipt}>
                {tr("Record verified filing")}
              </button>
            </form>
          )}
          {current.status === "filed" && (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                perform(async () => {
                  await api("partner/" + current.id, "PATCH", {
                    status: "resolved",
                    outcome: f.get("outcome"),
                  });
                  await load(current.id);
                }, tr("Outcome recorded"));
              }}
            >
              <label className="field">
                {tr("Official outcome")}
                <textarea name="outcome" required />
              </label>
              <button className="button">{tr("Record outcome")}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
