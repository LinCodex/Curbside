"use client";
import { usePreferences } from "./preferences";
import { Select } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

/** One keyboard-accessible, touch-friendly menu across every screen. */
export default function CustomSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: (string | { value: string; label: string })[];
  label: string;
}) {
  const { tr } = usePreferences();
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="custom-select-trigger" aria-label={tr(label)}>
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="custom-select-menu"
          position="popper"
          sideOffset={8}
          collisionPadding={16}
        >
          <Select.ScrollUpButton className="custom-select-scroll">
            <ChevronUp size={16} />
          </Select.ScrollUpButton>
          <Select.Viewport className="custom-select-viewport">
            {options.map((item) => {
              const option =
                typeof item === "string" ? { value: item, label: item } : item;
              return (
                <Select.Item
                  className="custom-select-item"
                  key={option.value}
                  value={option.value}
                >
                  <Select.ItemText>{tr(option.label)}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={15} />
                  </Select.ItemIndicator>
                </Select.Item>
              );
            })}
          </Select.Viewport>
          <Select.ScrollDownButton className="custom-select-scroll">
            <ChevronDown size={16} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
