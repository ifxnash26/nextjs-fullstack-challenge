"use client";

import type React from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

interface Props {
  workspaceId: string;
  exportUrl: string;
}

export function ImportExportBar({ workspaceId, exportUrl }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("workspaceId", workspaceId);
    formData.append("file", file);

    const res = await fetch("/api/assets/import", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setError("Import failed");
      setLoading(false);
      return;
    }

    const result = await res.json();
    setMessage(`Imported ${result.count} rows`);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? "Importing..." : "Import CSV"}
        </Button>
        <a
          href={exportUrl}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
        >
          Export CSV
        </a>
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
      </div>
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
