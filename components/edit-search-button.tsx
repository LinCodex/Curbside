"use client";
import { useEffect, useState } from "react";
import { PencilLine } from "lucide-react";
import { usePreferences } from "./preferences";

export default function EditSearchButton({
  formId,
  inputId,
}: {
  formId: string;
  inputId: string;
}) {
  const { tr } = usePreferences();
  const [formHidden, setFormHidden] = useState(false);
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setFormHidden(!entry.isIntersecting),
    );
    observer.observe(form);
    return () => observer.disconnect();
  }, [formId]);
  if (!formHidden) return null;
  return (
    <button
      type="button"
      className="edit-search-fab"
      onClick={() => {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        document
          .getElementById(formId)
          ?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
        document
          .getElementById(inputId)
          ?.focus({ preventScroll: true });
      }}
    >
      <PencilLine size={16} aria-hidden="true" />
      {tr("Edit search")}
    </button>
  );
}
