"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { PlanPreview } from "@/server/ai/actions/previewPlan";

export function AiInventoryManager({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [clarifying, setClarifying] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sendPlan = async (text: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPreview(null);
    setPlanId(null);
    try {
      const res = await fetch("/api/ai/actions/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, workspaceId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Could not plan that request.");
      }
      if (payload.clarifyingQuestion) {
        setError(payload.clarifyingQuestion);
        return;
      }
      setPlanId(payload.planId);
      setPreview(payload.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not plan that request.");
    } finally {
      setLoading(false);
    }
  };

  const onExecute = async () => {
    if (!planId || !preview) return;
    setExecuting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/ai/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          confirm: true,
          confirmationText: preview.confirmationText,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Execution failed.");
      }
      setSuccess(`Done. Affected ${payload.affectedCount} assets.`);
      setPreview(null);
      setPlanId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">AI Inventory Manager</p>
        <div className="flex items-center gap-2">
          <input
            className="w-64 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            placeholder="e.g. assign AS-1001 to Lee"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => sendPlan(message)}
            disabled={loading}
            className="rounded-full px-4"
            variant="secondary"
            size="sm"
          >
            {loading ? "Planning..." : "Plan"}
          </Button>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {preview ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Proposed plan</span>
            {preview.requiresConfirmation && preview.confirmationText ? (
              <span className="font-semibold text-amber-800">Requires confirm: {preview.confirmationText}</span>
            ) : null}
          </div>
          <div className="space-y-2">
            {preview.actions.map((action, index) => (
              <div key={index} className="rounded-md border border-border bg-card p-3 shadow-sm">
                <p className="text-sm font-semibold text-foreground">
                  {action.type} - {action.affectedCount} assets
                </p>
                {action.sample?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Sample: {action.sample.map((s) => s.assetTag || s.id).join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No matching assets yet.</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={onExecute} disabled={executing}>
              {executing ? "Executing..." : "Confirm & execute"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPreview(null)} disabled={executing}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error && error.toLowerCase().includes("what") ? (
        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          <p className="text-sm text-foreground">Clarify</p>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              value={clarifying}
              onChange={(e) => setClarifying(e.target.value)}
              placeholder="Describe what to do..."
            />
            <Button type="button" onClick={() => sendPlan(clarifying)} disabled={loading}>
              Send
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
