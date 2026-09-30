"use client";
import { usePreferences, PreferencesMenu } from "./preferences";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, FileText, ShieldCheck } from "lucide-react";
import CustomSelect from "./custom-select";
import {
  LEGAL_VERSION,
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
  const initialDoc = docName || docProp;
  const { tr } = usePreferences();
  const [clientDoc, setClientDoc] = useState<string | undefined>(initialDoc);

  useEffect(() => {
    if (!initialDoc && typeof window !== "undefined") {
      const seg = window.location.pathname
        .replace(/^\/legal\/?/, "")
        .split("/")[0]
        ?.replace(/\.html$/, "");
      if (seg && Object.hasOwn(legalDocuments, seg)) {
        setClientDoc(seg);
      }
    }
  }, [initialDoc]);

  const activeDoc = initialDoc || clientDoc;
  const page = activeDoc ? legalDocuments[activeDoc] : null;
  const sectionTitle = tr;

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.document !== "undefined"
    ) {
      const sub = page?.title ? tr(page.title) : tr("Legal & Policies");
      window.document.title = `Curbside | ${sub}`;
    }
  }, [page?.title, tr]);

  return (
    <div className="legal-shell">
      <a className="skip-link" href="#legal-content">
        {tr("Skip to content")}
      </a>
      <header className="legal-header">
        <div className="legal-header-brand">
          <a className="wordmark" href="/" aria-label={tr("Curbside home")}>
            <span className="curb-mark">
              <span />
              <span />
              <span />
            </span>
            curbside<span className="brand-period">.</span>
          </a>
        </div>
        <div className="legal-header-nav">
          <a
            href="/"
            className="legal-back-button"
            aria-label={tr("Back to Curbside")}
          >
            <ArrowLeft size={15} />
            <span>{tr("Back to Curbside")}</span>
          </a>
        </div>
        <div className="legal-header-actions">
          <PreferencesMenu />
        </div>
      </header>
      <main className="legal-main" id="legal-content">
        <div className="legal-heading">
          <div className="eyebrow">{tr("Curbside / Legal")}</div>
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
          {tr("Prelaunch version")} {LEGAL_VERSION} {tr("· September 27, 2026")}
        </div>
        {page ? (
          <div className="legal-layout">
            <nav className="legal-nav" aria-label={tr("Policies")}>
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
                <a href="/legal">
                  <ArrowLeft size={14} />
                  {tr("Overview")}
                </a>
                {Object.entries(legalDocuments).map(([key, p]) => (
                  <a
                    key={key}
                    href={"/legal/" + key}
                    aria-current={activeDoc === key ? "page" : undefined}
                  >
                    <FileText size={14} aria-hidden="true" />
                    {tr(p.title)}
                  </a>
                ))}
              </div>
              <details className="legal-contents">
                <summary>{tr("On this page")}</summary>
                <ol>
                  {page.sections.map((s, i) => (
                    <li key={s.title}>
                      <a href={"#section-" + (i + 1)}>
                        {sectionTitle(s.title)}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            </nav>
            <article className="legal-document">
              {page.sections.map((s, i) => (
                <section key={s.title} id={"section-" + (i + 1)}>
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
                <section>
                  <h2>{tr("Official reference material")}</h2>
                  <p>
                    {tr(
                      "These links explain selected requirements. They do not certify Curbside or replace an assessment of the operator’s actual practices.",
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
                <a className="legal-card" key={key} href={"/legal/" + key}>
                  <h2>
                    {tr(p.title)}
                    <ArrowUpRight size={19} />
                  </h2>
                  <p>{tr(p.description)}</p>
                </a>
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
    <aside className="legal-contact">
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
