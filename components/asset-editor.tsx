"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { ASSET_STATUSES, type AssetStatusValue } from "@/lib/constants";

interface AssetClientModel {
  id: string;
  status: AssetStatusValue;
  assignedToId: string | null;
  category: string | null;
  location: string | null;
  vendor: string | null;
  purchaseDate: string | null;
  warrantyEnd: string | null;
  notes: string | null;
  assignedTo?: { id: string; name: string | null } | null;
}

interface PersonClientModel {
  id: string;
  name: string;
}

interface Props {
  asset: AssetClientModel;
  people: PersonClientModel[];
  canEdit: boolean;
}

export function AssetEditor({ asset, people, canEdit }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState({
    status: asset.status as AssetStatusValue,
    assignedToId: asset.assignedToId ?? "",
    category: asset.category ?? "",
    location: asset.location ?? "",
    vendor: asset.vendor ?? "",
    purchaseDate: asset.purchaseDate ?? "",
    warrantyEnd: asset.warrantyEnd ?? "",
    notes: asset.notes ?? "",
  });

  const updateField = (key: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      status: formState.status,
      assignedToId: formState.assignedToId || null,
      category: formState.category || undefined,
      location: formState.location || undefined,
      vendor: formState.vendor || undefined,
      purchaseDate: formState.purchaseDate ? formState.purchaseDate : undefined,
      warrantyEnd: formState.warrantyEnd ? formState.warrantyEnd : undefined,
      notes: formState.notes || undefined,
    };

    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Unable to update asset");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="status">
            Status
          </label>
          <Select
            id="status"
            name="status"
            value={formState.status}
            onChange={(e) => updateField("status", e.target.value)}
            disabled={!canEdit}
          >
            {ASSET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="assignee">
            Assigned to
          </label>
          <Select
            id="assignee"
            name="assignee"
            value={formState.assignedToId ?? ""}
            onChange={(e) => updateField("assignedToId", e.target.value)}
            disabled={!canEdit}
          >
            <option value="">Unassigned</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="location">
            Location
          </label>
          <Input
            id="location"
            name="location"
            value={formState.location}
            onChange={(e) => updateField("location", e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="category">
            Category
          </label>
          <Input
            id="category"
            name="category"
            value={formState.category}
            onChange={(e) => updateField("category", e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="vendor">
            Vendor
          </label>
          <Input id="vendor" name="vendor" value={formState.vendor} onChange={(e) => updateField("vendor", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="purchaseDate">
            Purchase date
          </label>
          <Input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            value={formState.purchaseDate}
            onChange={(e) => updateField("purchaseDate", e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="warrantyEnd">
            Warranty end
          </label>
          <Input
            id="warrantyEnd"
            name="warrantyEnd"
            type="date"
            value={formState.warrantyEnd}
            onChange={(e) => updateField("warrantyEnd", e.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="notes">
          Notes
        </label>
        <Textarea
          id="notes"
          name="notes"
          rows={5}
          value={formState.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {canEdit ? (
        <Button
          type="submit"
          variant="outline"
          className="border-border bg-background text-foreground shadow-sm transition hover:bg-muted"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save changes"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">You have read-only access.</p>
      )}
    </form>
  );
}
