"use client";
import { usePreferences, PreferencesMenu } from "./preferences";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  ShieldCheck,
  CarFront,
  Search,
  Map,
  UserRound,
} from "lucide-react";
import CustomSelect from "./custom-select";
import {
  LEGAL_DISPLAY_REVISION,
  OPERATOR,
  legalDocuments,
  LEGAL_SOURCES,
} from "@/lib/legal";

export default function LegalPage({
  docName,
  document: docProp,
}: {
  docName?: string;
  document?: string;
}) {
  const activeDoc = docName || docProp;
  const { tr, locale } = usePreferences();
  const page = activeDoc ? legalDocuments[activeDoc] : null;
  const sectionTitle = tr;
  const [activeSection, setActiveSection] = useState("section-1");
  const sections = page
    ? [
        ...page.sections.map((s, i) => ({
          value: "section-" + (i + 1),
          label: s.title,
        })),
        ...(activeDoc === "sources"
          ? [{ value: "references", label: "Source references" }]
          : []),
        { value: "contact", label: "Contact the operator" },
      ]
    : [];

  useEffect(() => {
    if (!page) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const nodes = Array.from(
        window.document.querySelectorAll<HTMLElement>(".legal-document [id]"),
      );
      const threshold = window.matchMedia("(max-width: 800px)").matches
        ? (window.document.querySelector(".legal-nav")?.getBoundingClientRect()
            .bottom || 184) + 80
        : 100;
      const passed = nodes.filter(
        (node) => node.getBoundingClientRect().top <= threshold,
      );
      setActiveSection((passed.at(-1) || nodes[0])?.id || "section-1");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [page]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.document !== "undefined"
    ) {
      const sub = page?.title ? tr(page.title) : tr("Legal & Policies");
      window.document.title = `${locale === "zh" ? "罚单卫士" : "TicketSafe"} | ${sub}`;
    }
  }, [page?.title, tr, locale]);

  return (
    <div className="legal-shell">
      <a className="skip-link" href="#legal-content">
        {tr("Skip to content")}
      </a>
      <header className="legal-header">
        <div className="legal-header-brand">
          <Link
            className="wordmark"
            href="/"
            aria-label={tr("TicketSafe home")}
          >
            <span className="curb-mark">
              <span />
              <span />
              <span />
            </span>
            {locale === "zh" ? "罚单卫士" : "TicketSafe"}
            <span className="brand-period">.</span>
          </Link>
        </div>
        <nav className="legal-header-nav" aria-label={tr("Main navigation")}>
          {(
            [
              ["garage", "Garage", CarFront],
              ["search", "Search", Search],
              ["map", "Map", Map],
              ["account", "Account", UserRound],
            ] as const
          ).map(([view, label, Icon]) => (
            <Link
              key={view}
              href={"/?view=" + view}
              className="legal-main-link"
            >
              <Icon size={17} aria-hidden="true" />
              <span>{tr(label)}</span>
            </Link>
          ))}
        </nav>
        <div className="legal-header-actions">
          <PreferencesMenu />
        </div>
      </header>
      <main className="legal-main" id="legal-content">
        <div className="legal-heading">
          <div className="eyebrow">{tr("TicketSafe / Legal")}</div>
          <h1>
            {(page?.title && tr(page.title)) || tr("Clarity comes first.")}
          </h1>
          <p>
            {(page?.description && tr(page.description)) ||
              tr(
                "Your information, your choices, and the terms behind the service. Read each policy on its own page.",
              )}
          </p>
        </div>
        <div className="legal-status">
          <ShieldCheck size={14} aria-hidden="true" />
          {tr("Updated October 1, 2026")} · {LEGAL_DISPLAY_REVISION}
        </div>
        {page ? (
          <div className="legal-layout">
            <aside className="legal-nav">
              <nav
                className="legal-policy-navigation"
                aria-label={tr("Policies")}
              >
                <p className="legal-navigation-label">{tr("Policies")}</p>
                <div className="legal-policy-select">
                  <CustomSelect
                    label="Choose a policy"
                    value={activeDoc || "overview"}
                    onChange={(key) => {
                      window.location.assign(
                        key === "overview" ? "/legal" : "/legal/" + key,
                      );
                    }}
                    options={[
                      { value: "overview", label: "Overview" },
                      ...Object.entries(legalDocuments).map(([key, p]) => ({
                        value: key,
                        label: p.title,
                      })),
                    ]}
                  />
                </div>
                <div className="legal-policy-links">
                  <Link href="/legal">
                    <ArrowLeft size={14} />
                    {tr("Overview")}
                  </Link>
                  {Object.entries(legalDocuments).map(([key, p]) => (
                    <Link
                      key={key}
                      href={"/legal/" + key}
                      aria-current={activeDoc === key ? "page" : undefined}
                    >
                      <FileText size={14} aria-hidden="true" />
                      {tr(p.title)}
                    </Link>
                  ))}
                </div>
              </nav>
              <nav className="legal-contents" aria-label={tr("On this page")}>
                <p className="legal-navigation-label">{tr("On this page")}</p>
                <div className="legal-section-select">
                  <CustomSelect
                    label="Jump to section"
                    value={activeSection}
                    onChange={(id) => {
                      const section = window.document.getElementById(id);
                      if (!section) return;
                      window.history.replaceState(null, "", "#" + id);
                      section.scrollIntoView({
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "instant"
                          : "smooth",
                        block: "start",
                      });
                      section.focus({ preventScroll: true });
                      setActiveSection(id);
                    }}
                    options={sections}
                  />
                </div>
                <ol className="legal-section-links">
                  {sections.map((s, i) => (
                    <li key={s.value}>
                      <a
                        href={"#" + s.value}
                        aria-current={
                          activeSection === s.value ? "location" : undefined
                        }
                        onClick={() => setActiveSection(s.value)}
                      >
                        <span
                          className="legal-section-number"
                          aria-hidden="true"
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{sectionTitle(s.label)}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
            <article className="legal-document">
              {page.sections.map((s, i) => (
                <section key={s.title} id={"section-" + (i + 1)} tabIndex={-1}>
                  <h2>{sectionTitle(s.title)}</h2>
                  {s.paragraphs.map((p) => (
                    <p key={p}>{tr(p)}</p>
                  ))}
                  {s.bullets && (
                    <ul>
                      {s.bullets.map((b) => (
                        <li key={b}>{tr(b)}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
              {activeDoc === "sources" && (
                <section id="references" tabIndex={-1}>
                  <h2>{tr("Source references")}</h2>
                  <p>
                    {tr(
                      "These official sources explain the records and location services used by TicketSafe.",
                    )}
                  </p>
                  <div className="legal-reference-grid">
                    {LEGAL_SOURCES.map(([label, url]) => (
                      <a
                        className="legal-reference-card"
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>{tr(label)}</span>
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </section>
              )}
              <Contact />
            </article>
          </div>
        ) : (
          <>
            <div className="legal-cards">
              {Object.entries(legalDocuments).map(([key, p]) => (
                <Link className="legal-card" key={key} href={"/legal/" + key}>
                  <h2>
                    {tr(p.title)}
                    <ArrowUpRight size={19} />
                  </h2>
                  <p>{tr(p.description)}</p>
                </Link>
              ))}
            </div>
            <Contact />
          </>
        )}
      </main>
    </div>
  );
}
function Contact() {
  const { tr } = usePreferences();

  return (
    <aside className="legal-contact" id="contact" tabIndex={-1}>
      <h2 style={{ marginBottom: 12, fontSize: 16 }}>
        {tr("Contact the operator")}
      </h2>
      <address>
        {OPERATOR.name}
        <br />
        {OPERATOR.address}
        <br />
        <a href={"mailto:" + OPERATOR.email}>{OPERATOR.email}</a>
      </address>
    </aside>
  );
}
