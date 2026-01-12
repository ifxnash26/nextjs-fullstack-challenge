"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FilterSpec } from "@/lib/validators";
import { Direction, SortBy, Status } from "@/server/ai/filterSpec";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AiFilterState = {
  interpretedQuery: string;
  filterSpec?: FilterSpec;
  followUpQuestion?: string;
};

const statusLabels: Record<string, string> = {
  IN_STOCK: "In stock",
  ASSIGNED: "Assigned",
  REPAIR: "Repair",
  RETIRED: "Retired",
};

function mapSortToSortBy(value: string | null): SortBy | undefined {
  switch (value) {
    case "updatedAt":
      return SortBy.UPDATED;
    case "createdAt":
      return SortBy.CREATED;
    case "warrantyEnd":
      return SortBy.WARRANTY_END;
    case "purchaseDate":
      return SortBy.PURCHASE_DATE;
    default:
      return undefined;
  }
}

function formatFilterSummary(spec: FilterSpec) {
  const parts: string[] = [];
  if (spec.search) parts.push(`Search: ${spec.search}`);
  if (spec.category) parts.push(`Category: ${spec.category}`);
  if (spec.location) parts.push(`Location: ${spec.location}`);
  if (spec.assignedTo) parts.push(`Assigned to: ${spec.assignedTo}`);
  if (spec.statuses?.length) {
    parts.push(`Statuses: ${spec.statuses.map((status) => statusLabels[status] ?? status).join(", ")}`);
  }
  if (spec.warrantyExpiringInDays) parts.push(`Warranty in ${spec.warrantyExpiringInDays} days`);
  if (spec.purchasedWithinDays) parts.push(`Purchased within ${spec.purchasedWithinDays} days`);
  if (spec.sortBy) parts.push(`Sort: ${spec.sortBy.toLowerCase().replace("_", " ")}`);
  if (spec.direction) parts.push(`Direction: ${spec.direction.toLowerCase()}`);
  return parts.join(" | ");
}

export function AskAiFilter({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [aiResult, setAiResult] = useState<AiFilterState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [undoQuery, setUndoQuery] = useState<string | null>(null);

  const currentFilter = useMemo(() => {
    const normalizeStatus = (value: string) => {
      const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
      return normalized === "IN_USED" || normalized === "IN_USE" ? "ASSIGNED" : normalized;
    };
    const statuses = searchParams
      .getAll("status")
      .flatMap((value) => value.split(","))
      .map((value) => normalizeStatus(value))
      .filter((value) => Object.values(Status).includes(value as Status)) as Status[];

    const asNumber = (key: string) => {
      const value = searchParams.get(key);
      if (!value) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const spec: Partial<FilterSpec> = {};
    const search = searchParams.get("q");
    if (search) spec.search = search;
    const category = searchParams.get("category");
    if (category) spec.category = category;
    const location = searchParams.get("location");
    if (location) spec.location = location;
    const assignedTo = searchParams.get("assignedTo");
    if (assignedTo) spec.assignedTo = assignedTo;
    if (statuses.length) spec.statuses = statuses;

    const sortParam = searchParams.get("sort");
    const sortBy = mapSortToSortBy(sortParam);
    if (sortBy) spec.sortBy = sortBy;

    const direction = searchParams.get("direction");
    if (direction) spec.direction = direction.toUpperCase() as Direction;

    const warrantyExpiringInDays = asNumber("warrantyExpiringInDays");
    if (warrantyExpiringInDays) spec.warrantyExpiringInDays = warrantyExpiringInDays;

    const purchasedWithinDays = asNumber("purchasedWithinDays");
    if (purchasedWithinDays) spec.purchasedWithinDays = purchasedWithinDays;

    const limit = asNumber("limit");
    if (limit) spec.limit = limit;

    return spec;
  }, [searchParams]);

  const busy = loading || applying;

  const sendPrompt = async (text: string) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/ai/filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        workspaceId,
        currentFilter: aiResult?.filterSpec ?? currentFilter,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error || "Could not process your request right now.");
      setLoading(false);
      return;
    }

    const payload = (await res.json()) as AiFilterState;
    setAiResult(payload);
    setPrompt("");
    setLoading(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendPrompt(prompt);
  };

  const onFollowUp = async () => {
    if (!followUp.trim()) return;
    await sendPrompt(followUp);
    setFollowUp("");
  };

  const applyFilterSpec = (spec: FilterSpec) => {
    const params = new URLSearchParams(searchParams.toString());
    const keysToClear = [
      "q",
    "category",
    "location",
    "assignedTo",
      "sort",
      "direction",
      "warrantyExpiringInDays",
      "purchasedWithinDays",
      "limit",
    ];
    keysToClear.forEach((key) => params.delete(key));
    params.delete("status");

    if (spec.search) params.set("q", spec.search);
    if (spec.category) params.set("category", spec.category);
    if (spec.location) params.set("location", spec.location);
    if (spec.assignedTo) params.set("assignedTo", spec.assignedTo);
    if (spec.statuses?.length) spec.statuses.forEach((status) => params.append("status", status));
    if (spec.sortBy) {
      const sortMap: Record<SortBy, string> = {
        [SortBy.UPDATED]: "updatedAt",
        [SortBy.CREATED]: "createdAt",
        [SortBy.WARRANTY_END]: "warrantyEnd",
        [SortBy.PURCHASE_DATE]: "purchaseDate",
      };
      params.set("sort", sortMap[spec.sortBy]);
    }
    if (spec.direction) params.set("direction", spec.direction.toLowerCase());
    if (spec.warrantyExpiringInDays) params.set("warrantyExpiringInDays", spec.warrantyExpiringInDays.toString());
    if (spec.purchasedWithinDays) params.set("purchasedWithinDays", spec.purchasedWithinDays.toString());
    if (spec.limit) params.set("limit", spec.limit.toString());

    setUndoQuery(searchParams.toString());
    router.push(`/w/${workspaceId}/assets${params.toString() ? `?${params.toString()}` : ""}`);
    setMessage("Filter applied.");
  };

  const onApplyFilter = () => {
    if (!aiResult?.filterSpec) return;
    setApplying(true);
    applyFilterSpec(aiResult.filterSpec);
    setApplying(false);
  };

  const onUndo = () => {
    const previous = undoQuery;
    setUndoQuery(null);
    setAiResult(null);
    setMessage(previous ? "Reverted to your previous filter." : "Reverted to default filters.");
    router.push(`/w/${workspaceId}/assets${previous ? `?${previous}` : ""}`);
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Ask AI to build a filter</p>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Beta</span>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
        <Input
          name="prompt"
          placeholder="e.g. laptops in repair at HQ expiring warranty in 30 days"
          required
          className="flex-1"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <Button type="submit" disabled={busy} className="min-w-[124px]">
          {loading ? "Thinking..." : "Generate filter"}
        </Button>
      </form>

      {aiResult?.filterSpec ? (
        <Alert variant="warning" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-black">
                {formatFilterSummary(aiResult.filterSpec) || aiResult.interpretedQuery}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={onApplyFilter}
                disabled={applying}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:shadow-md transition"
              >
                {applying ? "Applying..." : "Apply filter"}
              </Button>
              <Button type="button" variant="ghost" onClick={onUndo} disabled={!undoQuery}>
                Undo
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {aiResult?.followUpQuestion ? (
        <Alert variant="warning" className="space-y-2">
          <p className="text-sm font-medium text-foreground">{aiResult.followUpQuestion}</p>
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              placeholder="Type your clarification..."
            />
            <Button type="button" onClick={onFollowUp} disabled={busy}>
              {loading ? "Sending..." : "Send answer"}
            </Button>
          </div>
        </Alert>
      ) : null}

      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}

