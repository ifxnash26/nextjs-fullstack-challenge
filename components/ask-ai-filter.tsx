"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function AskAiFilter({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = String(form.get("prompt") || "");
    const res = await fetch("/api/ai/filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      setError("Could not process your request right now.");
      setLoading(false);
      return;
    }

    const spec = await res.json();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");

    if (spec.search) params.set("q", spec.search);
    if (spec.vendor) params.set("vendor", spec.vendor);
    if (spec.location) params.set("location", spec.location);
    if (spec.category) params.set("category", spec.category);
    if (spec.assignedTo) params.set("assignedTo", spec.assignedTo);
    if (spec.statuses?.length) {
      spec.statuses.forEach((status: string) => params.append("status", status));
    }

    setLoading(false);
    router.push(`/w/${workspaceId}/assets?${params.toString()}`);
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Ask AI to build a filter</p>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Beta</span>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
        <Input name="prompt" placeholder="e.g. laptops in repair in the NYC office" required className="flex-1" />
        <Button type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Apply"}
        </Button>
      </form>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
