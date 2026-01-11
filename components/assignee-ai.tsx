"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AiAssigneeResponse = {
  success?: boolean;
  person?: { id: string; name: string; email?: string | null; title?: string | null };
  message?: string;
};

export function AssigneeAi({ workspaceId }: { workspaceId: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAssigneeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/assignees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, message }),
      });
      const payload = (await res.json()) as AiAssigneeResponse;
      if (!res.ok || payload.success === false) {
        throw new Error(payload.message || "Could not process request");
      }
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">AI Assignee Manager</p>
            <p className="text-xs text-muted-foreground">Add or update assignees by name/email/title.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='e.g. "Add Ariana Chen ariana@example.com as Ops Manager"'
            className="flex-1"
          />
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="rounded-full px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
          >
            {loading ? "Working..." : "Apply"}
          </Button>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {result?.person ? (
        <Alert variant="success">
          Added/updated: {result.person.name}
          {result.person.email ? ` • ${result.person.email}` : ""} {result.person.title ? ` • ${result.person.title}` : ""}
        </Alert>
      ) : null}
      {result?.message && !result.person ? <Alert variant="info">{result.message}</Alert> : null}
    </div>
  );
}
