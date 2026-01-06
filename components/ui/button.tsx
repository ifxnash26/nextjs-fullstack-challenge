import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";

const variants: Record<string, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary: "bg-muted text-foreground hover:bg-muted/80",
  outline: "border border-border bg-background hover:bg-muted/60",
  ghost: "hover:bg-muted text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  link: "underline-offset-4 hover:underline text-primary",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => {
    return (
      <button
        className={cn(base, variants[variant], className)}
        type={type}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
