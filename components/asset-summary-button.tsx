"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type SummaryPayload = {
  summaryBullets: string[];
  highlights?: {
    status?: string;
    assignee?: string;
    location?: string;
    warrantyStatus?: string;
  };
  riskFlags?: string[];
  generatedAt: string;
};

export function AssetSummaryButton({ assetId, workspaceId }: { assetId: string; workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    const res = await fetch("/api/ai/summarize-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, workspaceId }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error || "Unable to summarize right now.");
      setLoading(false);
      return;
    }

    const payload = (await res.json()) as SummaryPayload;
    setSummary(payload);
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!summary) return;
    const text = [
      "Asset summary:",
      ...(summary.summaryBullets || []),
      summary.riskFlags?.length ? `Risks: ${summary.riskFlags.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n- ");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          type="button"
          onClick={fetchSummary}
          disabled={loading}
          className="rounded-full px-4 text-sm font-semibold shadow-sm"
        >
          {loading ? "Summarizing..." : summary ? "Regenerate" : "Summarize"}
        </Button>
        {summary ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleCopy}
            disabled={copied}
            className="rounded-full px-3 text-sm font-semibold"
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {summary ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Generated {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}
            </span>
            {summary.highlights?.warrantyStatus ? <span>{summary.highlights.warrantyStatus}</span> : null}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {summary.summaryBullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
          {summary.riskFlags?.length ? (
            <div className="mt-3 text-xs font-semibold text-red-700">
              Risks: {summary.riskFlags.join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
