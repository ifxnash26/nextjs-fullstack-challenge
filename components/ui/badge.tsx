import * as React from "react";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  default: "bg-muted text-foreground border border-border",
  success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border border-amber-200",
  info: "bg-blue-100 text-blue-800 border border-blue-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof styles;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
