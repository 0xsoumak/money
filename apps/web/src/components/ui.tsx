import type { ButtonHTMLAttributes, ReactNode } from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

type Variant = "primary" | "outline" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:brightness-95 active:brightness-90",
  outline: "border-2 border-line-strong/30 text-ink hover:border-line-strong/70",
  ghost: "text-muted hover:bg-surface hover:text-ink",
  danger: "border-2 border-danger/50 text-danger hover:bg-danger/10",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        className,
      )}
    />
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Small uppercase section label. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-sm font-bold uppercase tracking-[0.12em] text-muted", className)}>
      {children}
    </p>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-line-strong pb-2">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em]">{title}</h2>
      {right}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 border-b border-line py-10">
      <p className="text-xl font-bold">{title}</p>
      {hint && <p className="max-w-md text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-strong/60", className)} />;
}

export const fieldClass =
  "min-h-12 w-full rounded-lg border-2 border-line-strong/25 bg-transparent px-3 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none";

export { cx };
