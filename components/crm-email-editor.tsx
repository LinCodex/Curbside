"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  Bold,
  Heading2,
  Link2,
  List,
  LoaderCircle,
  RectangleHorizontal,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import CrmSelect from "./crm-select";
import {
  CRM_TEMPLATES,
  unfilledPlaceholders,
  type CrmEmailKind,
  type CrmTemplateLanguage,
} from "@/lib/crm-templates";
import { crmClientRequest, type CrmSharedTemplate } from "@/lib/crm-client";

type Translate = (text: string) => string;
type Draft = { kind: CrmEmailKind; subject: string; message: string };

export function CrmTemplatePicker({
  client,
  canEdit,
  draft,
  disabled,
  onApply,
  tr,
}: {
  client: SupabaseClient;
  canEdit: boolean;
  draft: Draft;
  disabled: boolean;
  onApply: (draft: Draft) => void;
  tr: Translate;
}) {
  const [choice, setChoice] = useState("");
  const [language, setLanguage] = useState<CrmTemplateLanguage>("en");
  const [saved, setSaved] = useState<CrmSharedTemplate[]>([]);
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    crmClientRequest<{ templates: CrmSharedTemplate[] }>(client, "templates").then(
      (data) => {
        if (alive) setSaved(data.templates);
      },
      () => {
        if (alive) setNotice("Shared templates could not be loaded.");
      },
    );
    return () => {
      alive = false;
    };
  }, [client, revision]);
  const builtIn = CRM_TEMPLATES.filter((item) => item.kind === draft.kind);
  const mine = saved.filter((item) => item.kind === draft.kind);
  const selectedSaved = mine.find((item) => "saved:" + item.id === choice);
  const apply = () => {
    const template = choice.startsWith("saved:")
      ? selectedSaved
      : builtIn.find((item) => item.id === choice)?.content[language];
    if (!template) return;
    if (
      (draft.subject.trim() || draft.message.trim()) &&
      !window.confirm(tr("Replace the current subject and message?"))
    )
      return;
    onApply({
      kind: draft.kind,
      subject: template.subject,
      message: template.message,
    });
    setNotice("");
  };
  const run = async (
    action: "template_save" | "template_delete",
    input: Record<string, unknown>,
    done: string,
  ) => {
    setSaving(true);
    setNotice("");
    try {
      const result = await crmClientRequest<{ id?: string }>(
        client,
        action,
        input,
      );
      setNotice(done);
      setRevision((value) => value + 1);
      return result;
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "CRM unavailable. Please try again.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  };
  const save = async () => {
    const label = name.trim().slice(0, 60);
    if (!label || !draft.subject.trim() || !draft.message.trim()) return;
    const existing = mine.find(
      (item) => item.name.toLowerCase() === label.toLowerCase(),
    );
    if (
      existing &&
      !window.confirm(tr("Replace the shared template with this name?"))
    )
      return;
    const result = await run(
      "template_save",
      {
        kind: draft.kind,
        name: label,
        subject: draft.subject.trim(),
        message: draft.message.trim(),
      },
      "Template saved",
    );
    if (result?.id) {
      setChoice("saved:" + result.id);
      setName("");
    }
  };
  const remove = async () => {
    if (
      !selectedSaved ||
      !window.confirm(tr("Delete this shared template for every admin?"))
    )
      return;
    if (
      await run(
        "template_delete",
        { templateId: selectedSaved.id },
        "Template deleted",
      )
    )
      setChoice("");
  };
  const busy = disabled || saving;
  return (
    <div className="crm-template-picker">
      <div className="crm-template-row">
        <CrmSelect
          label={tr("Start from a template")}
          value={choice}
          onChange={setChoice}
          disabled={disabled}
          options={[
            { value: "", label: tr("Start from a template") },
            ...builtIn.map((item) => ({ value: item.id, label: tr(item.name) })),
            ...mine.map((item) => ({
              value: "saved:" + item.id,
              label: `${tr("Shared")}: ${item.name}`,
            })),
          ]}
        />
        {!choice.startsWith("saved:") && (
          <fieldset className="crm-segmented crm-template-language">
            <legend className="crm-sr-only">{tr("Template language")}</legend>
            {(["en", "zh"] as const).map((value) => (
              <label className={language === value ? "selected" : ""} key={value}>
                <input
                  type="radio"
                  name="crm-template-language"
                  value={value}
                  checked={language === value}
                  onChange={() => setLanguage(value)}
                  disabled={disabled}
                />
                <span>{value === "en" ? "English" : "中文"}</span>
              </label>
            ))}
          </fieldset>
        )}
        <button
          type="button"
          className="crm-button"
          onClick={apply}
          disabled={disabled || !choice}
        >
          {tr("Use template")}
        </button>
        {selectedSaved && canEdit && (
          <button
            type="button"
            className="crm-icon-button"
            onClick={() => void remove()}
            disabled={busy}
            aria-label={tr("Delete template")}
            title={tr("Delete template")}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {selectedSaved?.updated_by && (
        <p className="crm-fine-print">
          {tr("Last edited by")} {selectedSaved.updated_by}
        </p>
      )}
      {canEdit && (
        <div className="crm-template-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder={tr("Name this draft to share it with all admins")}
            aria-label={tr("Template name")}
            disabled={busy}
          />
          <button
            type="button"
            className="crm-button"
            onClick={() => void save()}
            disabled={
              busy ||
              !name.trim() ||
              !draft.subject.trim() ||
              !draft.message.trim()
            }
          >
            {saving ? (
              <LoaderCircle size={16} className="crm-spinner" />
            ) : (
              <Save size={16} />
            )}
            {tr("Save as template")}
          </button>
        </div>
      )}
      {notice && (
        <p className="crm-fine-print" role="status">
          {tr(notice)}
        </p>
      )}
    </div>
  );
}

export function CrmFormatToolbar({
  textarea,
  value,
  onChange,
  disabled,
  tr,
}: {
  textarea: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  tr: Translate;
}) {
  const edit = (
    transform: (selected: string) => { text: string; select?: [number, number] },
    wholeLines = false,
  ) => {
    const node = textarea.current;
    let start = node?.selectionStart ?? value.length;
    let end = node?.selectionEnd ?? value.length;
    if (wholeLines) {
      start = value.lastIndexOf("\n", start - 1) + 1;
      const next = value.indexOf("\n", end);
      end = next === -1 ? value.length : next;
    }
    const result = transform(value.slice(start, end));
    const nextValue = value.slice(0, start) + result.text + value.slice(end);
    if (nextValue.length > 10000) return;
    onChange(nextValue);
    requestAnimationFrame(() => {
      if (!node) return;
      node.focus();
      const [from, to] = result.select ?? [
        result.text.length,
        result.text.length,
      ];
      node.setSelectionRange(start + from, start + to);
    });
  };
  const wrap = (before: string, after: string, fallback: string) =>
    edit((selected) => {
      const inner = selected || fallback;
      return {
        text: before + inner + after,
        select: [before.length, before.length + inner.length],
      };
    });
  const prefix = (marker: string) =>
    edit(
      (selected) => ({
        text: (selected || "")
          .split("\n")
          .map((line) => (line.startsWith(marker) ? line : marker + line))
          .join("\n"),
      }),
      true,
    );
  const tools = [
    {
      label: "Bold",
      icon: Bold,
      run: () => wrap("**", "**", tr("bold text")),
    },
    { label: "Heading", icon: Heading2, run: () => prefix("## ") },
    { label: "Bullet list", icon: List, run: () => prefix("- ") },
    {
      label: "Link",
      icon: Link2,
      run: () => wrap("[", "](https://)", tr("link text")),
    },
    {
      label: "Button",
      icon: RectangleHorizontal,
      run: () =>
        edit(() => {
          const label = tr("Open TicketSafe");
          return {
            text: `\n[button: ${label}](/)\n`,
            select: [10, 10 + label.length],
          };
        }),
    },
  ];
  return (
    <div className="crm-format-toolbar" role="toolbar" aria-label={tr("Formatting")}>
      {tools.map(({ label, icon: Icon, run }) => (
        <button
          key={label}
          type="button"
          className="crm-icon-button"
          onClick={run}
          disabled={disabled}
          aria-label={tr(label)}
          title={tr(label)}
        >
          <Icon size={16} />
        </button>
      ))}
      <span className="crm-format-hint">
        {tr("Links starting with / open TicketSafe.")}
      </span>
    </div>
  );
}

export function CrmDraftChecks({
  subject,
  message,
  tr,
}: {
  subject: string;
  message: string;
  tr: Translate;
}) {
  const placeholders = unfilledPlaceholders(subject + "\n" + message);
  return (
    <div className="crm-draft-checks">
      <span>
        {tr("Subject")}: {subject.trim().length}/160 · {tr("Message")}:{" "}
        {message.trim().length}/10000
      </span>
      {!!placeholders.length && (
        <p className="crm-notice" role="status">
          <TriangleAlert size={16} />
          <span>
            {tr("Fill in before sending:")} {placeholders.join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
