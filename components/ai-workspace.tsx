"use client";

import { useMemo, useState } from "react";
import { AskAiFilter } from "@/components/ask-ai-filter";
import { DataQualityAudit } from "@/components/data-quality-audit";
import { AiInventoryManager } from "@/components/ai-inventory-manager";
import { AssetSummaryButton } from "@/components/asset-summary-button";
import { Button } from "@/components/ui/button";
import { AssigneeAi } from "@/components/assignee-ai";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";

type TabKey = "filter" | "audit" | "manager" | "assignees" | "summary";

export function AiWorkspace({
  workspaceId,
  assetId,
}: {
  workspaceId: string;
  assetId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("filter");
  const { data: session } = useSession();
  const userRole = ((session?.user as { role?: Role } | undefined)?.role as Role | undefined) ?? Role.VIEWER;
  const isViewer = userRole === Role.VIEWER;

  const tabs = useMemo(() => {
    const base: { key: TabKey; label: string }[] = [
      { key: "filter", label: "Filter" },
      { key: "audit", label: "Audit" },
    ];

    if (!isViewer) {
      base.push({ key: "manager", label: "Inventory" });
      base.push({ key: "assignees", label: "Assignees" });
    }
    if (assetId) {
      base.push({ key: "summary", label: "Summarize" });
    }
    return base;
  }, [assetId, isViewer]);

  const content = (() => {
    switch (activeTab) {
      case "filter":
        return (
          <AskAiFilter workspaceId={workspaceId} />
        );
      case "audit":
        return (
          <DataQualityAudit workspaceId={workspaceId} />
        );
      case "manager":
        return (
          <AiInventoryManager workspaceId={workspaceId} />
        );
      case "summary":
        return assetId ? (
          <AssetSummaryButton assetId={assetId} workspaceId={workspaceId} />
        ) : null;
      case "assignees":
        return <AssigneeAi workspaceId={workspaceId} />;
      default:
        return null;
    }
  })();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open ? (
        <div className="flex h-[min(70vh,640px)] w-[min(500px,calc(100vw-2.5rem))] flex-col rounded-2xl border border-border/80 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">AssetSpace AI</p>
              <p className="text-xl font-semibold text-foreground">Workspace assistant</p>
              <p className="text-sm text-muted-foreground">Filters, audits, planning, and summaries in one spot.</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setOpen(false)} title="Close">
                ✕
              </Button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "bg-blue-600 text-white shadow"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pb-1">{content}</div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) setActiveTab("filter");
        }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-blue-500 to-sky-400 text-xl font-bold text-white shadow-lg transition hover:scale-105"
        aria-label="Open workspace assistant"
      >
        <span aria-hidden="true">✦</span>
      </button>
    </div>
  );
}
