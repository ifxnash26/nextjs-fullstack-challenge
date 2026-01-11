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
  serialNumber: string | null;
  imeiNumber?: string | null;
  deviceSpec?: string | null;
  accessories?: string | null;
  brand?: string | null;
  category: string | null;
  location: string | null;
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
    serialNumber: asset.serialNumber ?? "",
    imeiNumber: asset.imeiNumber ?? "",
    deviceSpec: asset.deviceSpec ?? "",
    accessories: asset.accessories ?? "",
    brand: asset.brand ?? "",
    category: asset.category ?? "",
    location: asset.location ?? "",
    purchaseDate: asset.purchaseDate ?? "",
    warrantyEnd: asset.warrantyEnd ?? "",
    notes: asset.notes ?? "",
  });

  const isIpad = (formState.category || asset.category || "").toLowerCase().includes("ipad");

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
      serialNumber: formState.serialNumber || undefined,
      imeiNumber: formState.imeiNumber || undefined,
      deviceSpec: formState.deviceSpec || undefined,
      accessories: formState.accessories || undefined,
      brand: formState.brand || undefined,
      category: formState.category || undefined,
      location: formState.location || undefined,
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
          <label className="text-sm font-medium text-foreground" htmlFor="serialNumber">
            Serial number
          </label>
          <Input
            id="serialNumber"
            name="serialNumber"
            value={formState.serialNumber}
            onChange={(e) => updateField("serialNumber", e.target.value)}
            disabled={!canEdit}
            placeholder="e.g. SN-00123"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="brand">
            Brand
          </label>
          <Input
            id="brand"
            name="brand"
            value={formState.brand}
            onChange={(e) => updateField("brand", e.target.value)}
            disabled={!canEdit}
            placeholder="e.g. Apple"
          />
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
      {isIpad ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="imeiNumber">
              IMEI number
            </label>
            <Input
              id="imeiNumber"
              name="imeiNumber"
              value={formState.imeiNumber}
              onChange={(e) => updateField("imeiNumber", e.target.value)}
              disabled={!canEdit}
              placeholder="IMEI (for iPad)"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="deviceSpec">
              Device spec (iPad)
            </label>
            <Input
              id="deviceSpec"
              name="deviceSpec"
              value={formState.deviceSpec}
              onChange={(e) => updateField("deviceSpec", e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. 256GB, Wi-Fi + Cellular"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-foreground" htmlFor="accessories">
              Accessories (iPad)
            </label>
            <Input
              id="accessories"
              name="accessories"
              value={formState.accessories}
              onChange={(e) => updateField("accessories", e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. Pencil, keyboard case"
            />
          </div>
        </div>
      ) : null}
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
          variant="default"
          className="h-11 rounded-full px-5 font-semibold shadow-md transition hover:shadow-lg"
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

