import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "icon";

export function Button({
  className,
  variant = "secondary",
  size = "md",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "ghost" && "border-transparent bg-transparent hover:bg-muted",
        variant === "destructive" && "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4",
        size === "icon" && "h-9 w-9 p-0",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
