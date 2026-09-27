"use client";
import { usePreferences, PreferencesMenu } from "./preferences";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
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

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.document !== "undefined") {
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
        <PreferencesMenu />
        <a className="wordmark" href="/">
          curbside.
        </a>
        <a href="/">
          <ArrowLeft size={15} />
          {tr("Back to Curbside")}
        </a>
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
          {tr("Prelaunch version")} {LEGAL_VERSION} {tr("· September 27, 2026")}
        </div>
        {page ? (
          <div className="legal-layout">
            <nav className="legal-nav" aria-label={tr("Policies")}>
              <a href="/legal">{tr("Overview")}</a>
              {Object.entries(legalDocuments).map(([key, p]) => (
                <a
                  key={key}
                  href={"/legal/" + key}
                  aria-current={activeDoc === key ? "page" : undefined}
                >
                  {tr(p.title)}
                </a>
              ))}
            </nav>
            <article className="legal-document">
              {page.sections.map((s, i) => (
                <section key={s.title} id={"section-" + (i + 1)}>
                  <h2>{s.title.split(" — ").map(tr).join(" — ")}</h2>
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
                  <ul>
                    {LEGAL_SOURCES.map(([label, url]) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer">
                          {tr(label)}
                        </a>
                      </li>
                    ))}
                  </ul>
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
