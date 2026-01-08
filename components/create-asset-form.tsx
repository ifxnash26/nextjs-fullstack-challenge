"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { ASSET_STATUSES, type AssetStatusValue } from "@/lib/constants";

export function CreateAssetForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      workspaceId,
      assetTag: String(form.get("assetTag") || ""),
      serialNumber: form.get("serialNumber") || undefined,
      category: form.get("category") || undefined,
      brand: form.get("brand") || undefined,
      model: form.get("model") || undefined,
      location: form.get("location") || undefined,
      status: String(form.get("status") || ASSET_STATUSES[0]) as AssetStatusValue,
      notes: form.get("notes") || undefined,
    };

    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Unable to create asset");
      setLoading(false);
      return;
    }

    setLoading(false);
    (event.target as HTMLFormElement).reset();
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="assetTag">
            Asset tag *
          </label>
          <Input id="assetTag" name="assetTag" required placeholder="AS-0042" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={ASSET_STATUSES[0]}>
            {ASSET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="category">
            Category
          </label>
          <Input id="category" name="category" placeholder="Laptop" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="brand">
            Brand
          </label>
          <Input id="brand" name="brand" placeholder="Apple" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="model">
            Model
          </label>
          <Input id="model" name="model" placeholder="MacBook Pro" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="location">
            Location
          </label>
          <Input id="location" name="location" placeholder="NYC HQ" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="serialNumber">
            Serial number
          </label>
          <Input id="serialNumber" name="serialNumber" placeholder="SN-00123" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="notes">
          Notes
        </label>
        <Textarea id="notes" name="notes" placeholder="Procured via FY26 budget..." />
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button
        type="submit"
        disabled={loading}
        className="h-10 w-full rounded-full px-4 font-semibold"
      >
        {loading ? "Saving..." : "Create"}
      </Button>
    </form>
  );
}
