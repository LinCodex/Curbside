"use client";
import { CHANGELOG, CURRENT_VERSION } from "@/lib/changelog";
import { usePreferences } from "./preferences";

export default function Changelog() {
  const { tr, locale } = usePreferences();
  return (
    <div className="changelog">
      <p className="small muted">
        {tr("You are using version")} {CURRENT_VERSION}
      </p>
      <ol className="changelog-list">
        {CHANGELOG.map((release) => (
          <li key={release.version ?? release.date} className="changelog-release">
            <div className="changelog-release-head">
              <span className="changelog-version">
                {release.version ? `v${release.version}` : tr("Before 1.0")}
              </span>
              <time className="mono muted">{release.date}</time>
            </div>
            <h3>{release.title[locale]}</h3>
            <ul>
              {release.changes.map((change) => (
                <li key={change.en}>{change[locale]}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
