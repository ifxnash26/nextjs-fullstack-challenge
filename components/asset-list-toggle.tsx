"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

type AssetListToggleProps = {
  children: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
};

export function AssetListToggle({ children, count, defaultOpen = false }: AssetListToggleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const label = open ? "Hide list" : "Show list";
  const countLabel = count === 1 ? "1 asset" : `${count} assets`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Assets</p>
          <p className="text-xs text-muted-foreground">{countLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-3"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={label}
        >
          <span className="flex items-center gap-1">
            {label} {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </Button>
      </div>
      {open ? children : null}
    </div>
  );
}
