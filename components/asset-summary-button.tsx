"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function AssetSummaryButton({ assetId }: { assetId: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/assets/${assetId}/summary`);
    if (!res.ok) {
      setError("Unable to summarize right now.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setSummary(data.summary);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <Button variant="secondary" type="button" onClick={handleClick} disabled={loading}>
        {loading ? "Summarizing..." : "Summarize asset"}
      </Button>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {summary ? <Alert variant="info">{summary}</Alert> : null}
    </div>
  );
}
