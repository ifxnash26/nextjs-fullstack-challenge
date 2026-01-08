"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import type { CreateSpec } from "@/lib/ai";
import type { FilterSpec } from "@/lib/validators";

type PendingUpdate = {
  spec: FilterSpec;
  update: { status?: string; category?: string; assignedTo?: string; location?: string };
  count: number;
  sample?: { assetTag: string; status: string }[];
};

type PendingCreate = {
  create: CreateSpec;
  count: number;
  range?: { start: string; end: string };
  sample?: string[];
};

type PendingDelete = {
  spec: FilterSpec;
  count: number;
  sample?: { assetTag: string; status: string }[];
};

export function AskAiFilter({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [applyingFilter, setApplyingFilter] = useState(false);
  const [applyingDelete, setApplyingDelete] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<FilterSpec | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const busy = loading || applying || creating || applyingFilter || applyingDelete;

  const formatStatus = (value: string) =>
    value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const formatLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  const formatName = (value: string) =>
    value
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const formatUpdateSummary = (update: PendingUpdate["update"]) => {
    const parts: string[] = [];
    if (update.status) parts.push(`Status: ${formatStatus(update.status)}`);
    if (update.category) parts.push(`Category: ${formatLabel(update.category)}`);
    if (update.assignedTo) parts.push(`Assign to: ${formatName(update.assignedTo)}`);
    if (update.location) parts.push(`Location: ${formatLabel(update.location)}`);
    return parts.join(" | ");
  };

  const updateSummary = pendingUpdate ? formatUpdateSummary(pendingUpdate.update) : "";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setPendingFilter(null);
    setPendingUpdate(null);
    setPendingCreate(null);
    setPendingDelete(null);

    const form = new FormData(event.currentTarget);
    const text = String(form.get("prompt") || "");
    const res = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, workspaceId }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error || "Could not process your request right now.");
      setLoading(false);
      return;
    }

    const result = await res.json();
    if (result.intent === "filter") {
      setPendingFilter(result.spec);
      setLoading(false);
      return;
    }

    if (result.intent === "delete") {
      setPendingDelete({
        spec: result.spec,
        count: result.count,
        sample: result.sample,
      });
      setLoading(false);
      return;
    }

    if (result.intent === "update") {
      setPendingUpdate({
        spec: result.spec,
        update: result.update,
        count: result.count,
        sample: result.sample,
      });
      setLoading(false);
      return;
    }

    if (result.intent === "create") {
      setPendingCreate({
        create: result.create,
        count: result.count,
        range: result.range,
        sample: result.sample,
      });
      setLoading(false);
      return;
    }

    if (result.intent === "unknown") {
      setError(result.message || "Could not process that request.");
      setLoading(false);
      return;
    }

    const spec = result.spec;
    setPendingFilter(spec);
    setLoading(false);
  };

  const onApplyUpdate = async () => {
    if (!pendingUpdate) return;
    setApplying(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        apply: true,
        spec: pendingUpdate.spec,
        update: pendingUpdate.update,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error || "Could not apply that update.");
      setApplying(false);
      return;
    }

    const payload = await res.json();
    setPendingUpdate(null);
    setPendingFilter(null);
    setPendingDelete(null);
    setPendingCreate(null);
    setApplying(false);
    setMessage(`Updated ${payload.updatedCount ?? 0} assets.`);
    router.refresh();
  };

  const onApplyCreate = async () => {
    if (!pendingCreate) return;
    setCreating(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        apply: true,
        create: pendingCreate.create,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error || "Could not create those assets.");
      setCreating(false);
      return;
    }

    const payload = await res.json();
    setPendingCreate(null);
    setPendingFilter(null);
    setPendingUpdate(null);
    setPendingDelete(null);
    setCreating(false);
    setMessage(`Created ${payload.createdCount ?? 0} assets.`);
    router.refresh();
  };

  const onApplyFilter = async () => {
    if (!pendingFilter) return;
    setApplyingFilter(true);
    setError(null);
    setMessage(null);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");

    if (pendingFilter.search) params.set("q", pendingFilter.search);
    if (pendingFilter.vendor) params.set("vendor", pendingFilter.vendor);
    if (pendingFilter.location) params.set("location", pendingFilter.location);
    if (pendingFilter.category) params.set("category", pendingFilter.category);
    if (pendingFilter.assignedTo) params.set("assignedTo", pendingFilter.assignedTo);
    if (pendingFilter.statuses?.length) {
      pendingFilter.statuses.forEach((status: string) => params.append("status", status));
    }

    setApplyingFilter(false);
    setPendingFilter(null);
    setPendingDelete(null);
    setPendingUpdate(null);
    setPendingCreate(null);
    router.push(`/w/${workspaceId}/assets?${params.toString()}`);
  };

  const formatFilterSummary = (spec: FilterSpec) => {
    const parts: string[] = [];
    if (spec.search) parts.push(`Search: ${spec.search}`);
    if (spec.vendor) parts.push(`Vendor: ${formatLabel(spec.vendor)}`);
    if (spec.location) parts.push(`Location: ${formatLabel(spec.location)}`);
    if (spec.category) parts.push(`Category: ${formatLabel(spec.category)}`);
    if (spec.assignedTo) parts.push(`Assigned to: ${formatName(spec.assignedTo)}`);
    if (spec.statuses?.length) parts.push(`Statuses: ${spec.statuses.map(formatStatus).join(", ")}`);
    return parts.join(" | ");
  };

  const onApplyDelete = async () => {
    if (!pendingDelete) return;
    setApplyingDelete(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        apply: true,
        delete: true,
        spec: pendingDelete.spec,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error || "Could not delete those assets.");
      setApplyingDelete(false);
      return;
    }

    const payload = await res.json();
    setPendingDelete(null);
    setPendingFilter(null);
    setPendingUpdate(null);
    setPendingCreate(null);
    setApplyingDelete(false);
    setMessage(`Deleted ${payload.deletedCount ?? 0} assets.`);
    router.refresh();
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Ask AI to filter, update, or add assets</p>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Beta</span>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
        <Input
          name="prompt"
          placeholder="e.g. change all ipads to assigned, or add 70 laptops with MYPC001"
          required
          className="flex-1"
        />
        <Button type="submit" disabled={busy} className="min-w-[96px]">
          {loading ? "Thinking..." : "Apply"}
        </Button>
      </form>
      {pendingUpdate ? (
        <Alert variant="warning" className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p>
              Ready to update {pendingUpdate.count} assets{updateSummary ? ` (${updateSummary}).` : "."}
            </p>
            {pendingUpdate.sample?.length ? (
              <p className="text-xs text-amber-900/80">
                Examples: {pendingUpdate.sample.map((item) => item.assetTag).join(", ")}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={onApplyUpdate} disabled={applying}>
              {applying ? "Applying..." : "Apply update"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPendingUpdate(null)} disabled={applying}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}
      {pendingDelete ? (
        <Alert variant="error" className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p>Delete {pendingDelete.count} assets?</p>
            <p className="text-xs text-red-900/80">
              {formatFilterSummary(pendingDelete.spec) || "No filter details provided."}
            </p>
            {pendingDelete.sample?.length ? (
              <p className="text-xs text-red-900/80">Examples: {pendingDelete.sample.map((item) => item.assetTag).join(", ")}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="destructive" onClick={onApplyDelete} disabled={applyingDelete}>
              {applyingDelete ? "Deleting..." : "Delete assets"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)} disabled={applyingDelete}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}
      {pendingCreate ? (
        <Alert variant="warning" className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p>
              Ready to create {pendingCreate.count} assets
              {pendingCreate.range ? ` (${pendingCreate.range.start} to ${pendingCreate.range.end})` : ""}.
            </p>
            {pendingCreate.create.category ? (
              <p className="text-xs text-amber-900/80">Category: {pendingCreate.create.category}</p>
            ) : null}
            {pendingCreate.create.status ? (
              <p className="text-xs text-amber-900/80">Status: {formatStatus(pendingCreate.create.status)}</p>
            ) : null}
            {pendingCreate.sample?.length ? (
              <p className="text-xs text-amber-900/80">Examples: {pendingCreate.sample.join(", ")}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={onApplyCreate} disabled={creating}>
          {creating ? "Creating..." : "Create assets"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setPendingCreate(null)} disabled={creating}>
          Cancel
        </Button>
      </div>
    </Alert>
      ) : null}
      {pendingFilter ? (
        <Alert variant="warning" className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p>Apply this filter?</p>
            <p className="text-xs text-amber-900/80">{formatFilterSummary(pendingFilter) || "No details provided."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={onApplyFilter} disabled={applyingFilter}>
              {applyingFilter ? "Applying..." : "Apply filter"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPendingFilter(null)} disabled={applyingFilter}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}




