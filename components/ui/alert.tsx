import * as React from "react";
import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  info: "bg-blue-50 text-blue-900 border border-blue-200",
  warning: "bg-amber-50 text-amber-900 border border-amber-200",
  error: "bg-red-50 text-red-900 border border-red-200",
  success: "bg-emerald-50 text-emerald-900 border border-emerald-200",
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants;
}

export function Alert({ className, variant = "info", ...props }: AlertProps) {
  return <div className={cn("rounded-md px-3 py-2 text-sm", variants[variant], className)} {...props} />;
}
