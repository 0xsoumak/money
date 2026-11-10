import { Select as BaseSelect } from "@base-ui/react/select";
import { cx, fieldClass } from "./ui";

export interface Option {
  value: string;
  label: string;
}

/** A dark, keyboard-friendly replacement for the native <select>. */
export function Select({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  /** Accessible name. */
  label: string;
  className?: string;
}) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(v) => {
        if (typeof v === "string") onValueChange(v);
      }}
      items={options}
    >
      <BaseSelect.Trigger
        aria-label={label}
        className={cx(
          fieldClass.replace("w-full", ""),
          "flex cursor-pointer items-center justify-between gap-3 text-left",
          className ?? "w-full",
        )}
      >
        <BaseSelect.Value className="truncate" />
        <BaseSelect.Icon className="shrink-0 text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50">
          <BaseSelect.Popup className="max-h-[min(24rem,var(--available-height))] min-w-(--anchor-width) overflow-y-auto rounded-lg border-2 border-line-strong/30 bg-surface p-1 shadow-2xl outline-none">
            {options.map((o) => (
              <BaseSelect.Item
                key={o.value}
                value={o.value}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md px-3 text-base text-ink outline-none data-highlighted:bg-surface-strong data-selected:font-bold"
              >
                <BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator className="text-accent">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="m5 12 5 5 9-10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
