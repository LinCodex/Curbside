"use client";

import { Select } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useState } from "react";

const emptyValue = "__crm_all__";

export default function CrmSelect({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  const [portalContainer, setPortalContainer] =
    useState<HTMLDialogElement | null>(null);
  const attachTrigger = useCallback((node: HTMLButtonElement | null) => {
    // Native modal dialogs make portals outside their top layer inert.
    setPortalContainer(node?.closest("dialog") || null);
  }, []);
  return (
    <Select.Root
      value={value || emptyValue}
      onValueChange={(next) => onChange(next === emptyValue ? "" : next)}
      disabled={disabled}
    >
      <Select.Trigger
        ref={attachTrigger}
        className="crm-select-trigger"
        aria-label={label}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={portalContainer || undefined}>
        <Select.Content
          className="crm-select-menu"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <Select.ScrollUpButton className="crm-select-scroll">
            <ChevronUp size={16} />
          </Select.ScrollUpButton>
          <Select.Viewport className="crm-select-viewport">
            {options.map((option) => (
              <Select.Item
                className="crm-select-option"
                value={option.value || emptyValue}
                key={option.value || emptyValue}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="crm-select-scroll">
            <ChevronDown size={16} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
