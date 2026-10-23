import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mx-4 rounded-3xl bg-surface ${className}`}>{children}</section>;
}

export function PageHeader({ title, right }: { title?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex h-14 items-center justify-between px-5">
      <div className="text-[20px] font-bold">{title}</div>
      {right}
    </header>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-ink text-surface",
    secondary: "bg-surface-2 text-ink",
    danger: "bg-surface-2 text-danger",
  }[variant];
  return (
    <button
      {...props}
      className={`h-13 rounded-2xl px-5 text-[16px] font-semibold transition active:scale-[0.98] disabled:opacity-40 ${styles} ${className}`}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 flex-1 rounded-lg text-[14px] font-medium transition ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-3"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
