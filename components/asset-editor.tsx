"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { ASSET_STATUSES, getAssetStatusLabel, type AssetStatusValue } from "@/lib/constants";

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
  categories: string[];
  canEdit: boolean;
}

export function AssetEditor({ asset, people, categories, canEdit }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assigneeMenuRef = useRef<HTMLDivElement | null>(null);
  const assigneeInputRef = useRef<HTMLInputElement | null>(null);
  const customCategoryValue = "__custom__";
  const normalizeCategory = (value: string) => value.trim().replace(/\s+/g, " ");
  const categoryMap = new Map(
    categories.map((category) => [normalizeCategory(category).toLowerCase(), category]),
  );
  const initialCategory = asset.category ?? "";
  const initialCategoryKey = normalizeCategory(initialCategory).toLowerCase();
  const matchedCategory = initialCategoryKey ? categoryMap.get(initialCategoryKey) : undefined;
  const initialCategoryValue = matchedCategory ?? initialCategory;
  const initialCategorySelection = matchedCategory ? matchedCategory : initialCategory ? customCategoryValue : "";
  const initialCustomCategory = matchedCategory ? "" : initialCategory;
  const [formState, setFormState] = useState({
    status: asset.status as AssetStatusValue,
    assignedToId: asset.assignedToId ?? "",
    serialNumber: asset.serialNumber ?? "",
    imeiNumber: asset.imeiNumber ?? "",
    deviceSpec: asset.deviceSpec ?? "",
    accessories: asset.accessories ?? "",
    brand: asset.brand ?? "",
    category: initialCategoryValue ?? "",
    location: asset.location ?? "",
    purchaseDate: asset.purchaseDate ?? "",
    warrantyEnd: asset.warrantyEnd ?? "",
    notes: asset.notes ?? "",
  });
  const [categoryValue, setCategoryValue] = useState(initialCategorySelection);
  const [customCategory, setCustomCategory] = useState(initialCustomCategory);

  const normalizedCategory = (formState.category || "").trim().toLowerCase();
  const isIpad = normalizedCategory.includes("ipad");
  const isLaptop = normalizedCategory.includes("laptop");
  const showDeviceSpec = isIpad || isLaptop;
  const deviceSpecLabel = isLaptop ? "Device spec (Laptop)" : "Device spec (iPad)";
  const deviceSpecPlaceholder = isLaptop ? "e.g. 16GB RAM, 512GB SSD" : "e.g. 256GB, Wi-Fi + Cellular";
  const normalizedAssigneeFilter = assigneeSearch.trim().toLowerCase();
  const filteredPeople = normalizedAssigneeFilter
    ? people.filter((person) => person.name.toLowerCase().includes(normalizedAssigneeFilter))
    : people;
  const selectedPerson = formState.assignedToId
    ? people.find((person) => person.id === formState.assignedToId)
    : undefined;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!assigneeMenuRef.current) return;
      if (!assigneeMenuRef.current.contains(event.target as Node)) {
        setAssigneeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  useEffect(() => {
    if (assigneeOpen) {
      assigneeInputRef.current?.focus();
    }
  }, [assigneeOpen]);

  const updateField = (key: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAssigneeMenu = () => {
    if (!canEdit) return;
    if (assigneeOpen) {
      setAssigneeOpen(false);
      return;
    }
    setAssigneeSearch("");
    setAssigneeOpen(true);
  };

  const selectAssignee = (id: string) => {
    updateField("assignedToId", id);
    setAssigneeOpen(false);
    setAssigneeSearch("");
  };

  const handleCategoryChange = (value: string) => {
    setCategoryValue(value);
    if (value === customCategoryValue) {
      updateField("category", customCategory);
      return;
    }
    setCustomCategory("");
    updateField("category", value);
  };

  const handleCustomCategoryChange = (value: string) => {
    setCustomCategory(value);
    updateField("category", value);
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
                {getAssetStatusLabel(status)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="assignee">
            Assigned to
          </label>
          <div className="relative" ref={assigneeMenuRef}>
            <button
              type="button"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={toggleAssigneeMenu}
              disabled={!canEdit}
              aria-haspopup="listbox"
              aria-expanded={assigneeOpen}
              id="assignee"
            >
              <span className={selectedPerson ? "text-foreground" : "text-muted-foreground"}>
                {selectedPerson ? selectedPerson.name : "Unassigned"}
              </span>
              <span className="text-xs text-muted-foreground">v</span>
            </button>
            {assigneeOpen ? (
              <div className="absolute z-10 mt-2 w-full rounded-md border border-border bg-card p-2 shadow-lg">
                <label className="sr-only" htmlFor="assigneeSearch">
                  Search assignees
                </label>
                <Input
                  id="assigneeSearch"
                  ref={assigneeInputRef}
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  placeholder="Search assignees..."
                  className="h-9"
                />
                <div className="mt-2 max-h-48 overflow-auto">
                  {!normalizedAssigneeFilter || "unassigned".includes(normalizedAssigneeFilter) ? (
                    <button
                      type="button"
                      className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-muted/60"
                      onClick={() => selectAssignee("")}
                    >
                      Unassigned
                    </button>
                  ) : null}
                  {filteredPeople.length ? (
                    filteredPeople.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        className={`flex w-full items-center rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60 ${
                          person.id === formState.assignedToId ? "bg-muted text-foreground font-semibold" : "text-foreground"
                        }`}
                        onClick={() => selectAssignee(person.id)}
                      >
                        {person.name}
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No matches found.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
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
          <Select
            id="category"
            name="category"
            value={categoryValue}
            onChange={(e) => handleCategoryChange(e.target.value)}
            disabled={!canEdit}
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
            <option value={customCategoryValue}>Add new category...</option>
          </Select>
        </div>
        {categoryValue === customCategoryValue ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="customCategory">
              New category
            </label>
            <Input
              id="customCategory"
              name="customCategory"
              value={customCategory}
              onChange={(e) => handleCustomCategoryChange(e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. Monitor"
            />
          </div>
        ) : null}
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
      {showDeviceSpec ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {isIpad ? (
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
          ) : null}
          <div className={`space-y-1.5${isIpad ? "" : " md:col-span-2"}`}>
            <label className="text-sm font-medium text-foreground" htmlFor="deviceSpec">
              {deviceSpecLabel}
            </label>
            <Input
              id="deviceSpec"
              name="deviceSpec"
              value={formState.deviceSpec}
              onChange={(e) => updateField("deviceSpec", e.target.value)}
              disabled={!canEdit}
              placeholder={deviceSpecPlaceholder}
            />
          </div>
          {isIpad ? (
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
          ) : null}
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

