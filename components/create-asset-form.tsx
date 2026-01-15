"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { ASSET_STATUSES, getAssetStatusLabel, type AssetStatusValue } from "@/lib/constants";

type PersonOption = { id: string; name: string };

export function CreateAssetForm({
  workspaceId,
  categories,
  people,
}: {
  workspaceId: string;
  categories: string[];
  people: PersonOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const customCategoryValue = "__custom__";
  const [categoryValue, setCategoryValue] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const assigneeMenuRef = useRef<HTMLDivElement | null>(null);
  const assigneeInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveCategory = categoryValue === customCategoryValue ? customCategory : categoryValue;
  const normalizedCategory = effectiveCategory.trim().toLowerCase();
  const isIpad = normalizedCategory.includes("ipad");
  const isLaptop = normalizedCategory.includes("laptop");
  const showDeviceSpec = isIpad || isLaptop;
  const deviceSpecLabel = isLaptop ? "Device spec (Laptop)" : "Device spec (iPad)";
  const deviceSpecPlaceholder = isLaptop ? "e.g. 16GB RAM, 512GB SSD" : "e.g. 256GB, Wi-Fi + Cellular";
  const normalizedAssigneeFilter = assigneeSearch.trim().toLowerCase();
  const filteredPeople = normalizedAssigneeFilter
    ? people.filter((person) => person.name.toLowerCase().includes(normalizedAssigneeFilter))
    : people;
  const selectedPerson = selectedAssigneeId
    ? people.find((person) => person.id === selectedAssigneeId)
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

  const toggleAssigneeMenu = () => {
    if (assigneeOpen) {
      setAssigneeOpen(false);
      return;
    }
    setAssigneeSearch("");
    setAssigneeOpen(true);
  };

  const selectAssignee = (id: string) => {
    setSelectedAssigneeId(id);
    setAssigneeOpen(false);
    setAssigneeSearch("");
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const rawCategory = form.get("category");
    const categoryValue = rawCategory === customCategoryValue ? form.get("customCategory") : rawCategory;
    const category =
      typeof categoryValue === "string" && categoryValue.trim() ? categoryValue.trim() : undefined;
    const assignedToIdRaw = form.get("assignedToId");
    const assignedToId =
      typeof assignedToIdRaw === "string" && assignedToIdRaw.trim() ? assignedToIdRaw : null;

    const payload = {
      workspaceId,
      assetTag: String(form.get("assetTag") || ""),
      serialNumber: form.get("serialNumber") || undefined,
      category,
      brand: form.get("brand") || undefined,
      model: form.get("model") || undefined,
      location: form.get("location") || undefined,
      status: String(form.get("status") || ASSET_STATUSES[0]) as AssetStatusValue,
      assignedToId,
      deviceSpec: form.get("deviceSpec") || undefined,
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
    setCategoryValue("");
    setCustomCategory("");
    setSelectedAssigneeId("");
    setAssigneeSearch("");
    setAssigneeOpen(false);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
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
                {getAssetStatusLabel(status)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="assignedTo">
            Assigned to
          </label>
          <input type="hidden" name="assignedToId" value={selectedAssigneeId} />
          <div className="relative" ref={assigneeMenuRef}>
            <button
              type="button"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={toggleAssigneeMenu}
              aria-haspopup="listbox"
              aria-expanded={assigneeOpen}
              id="assignedTo"
            >
              <span className={selectedPerson ? "text-foreground" : "text-muted-foreground"}>
                {selectedPerson ? selectedPerson.name : "Unassigned"}
              </span>
              <span className="text-xs text-muted-foreground">v</span>
            </button>
            {assigneeOpen ? (
              <div className="absolute z-10 mt-2 w-full rounded-md border border-border bg-card p-2 shadow-lg">
                <label className="sr-only" htmlFor="assignedToSearch">
                  Search assignees
                </label>
                <Input
                  id="assignedToSearch"
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
                          person.id === selectedAssigneeId ? "bg-muted text-foreground font-semibold" : "text-foreground"
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
          <Input id="location" name="location" placeholder="NYC HQ" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="category">
            Category
          </label>
          <Select
            id="category"
            name="category"
            value={categoryValue}
            onChange={(e) => {
              const value = e.target.value;
              setCategoryValue(value);
              if (value !== customCategoryValue) {
                setCustomCategory("");
              }
            }}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
            <option value={customCategoryValue}>Add new category...</option>
          </Select>
        </div>
        {categoryValue === customCategoryValue ? (
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-foreground" htmlFor="customCategory">
              New category
            </label>
            <Input
              id="customCategory"
              name="customCategory"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Monitor"
              required
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="serialNumber">
            Serial number
          </label>
          <Input id="serialNumber" name="serialNumber" placeholder="SN-00123" />
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
        {showDeviceSpec ? (
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-foreground" htmlFor="deviceSpec">
              {deviceSpecLabel}
            </label>
            <Input id="deviceSpec" name="deviceSpec" placeholder={deviceSpecPlaceholder} />
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="notes">
          Notes
        </label>
        <Textarea id="notes" name="notes" rows={5} placeholder="Procured via FY26 budget..." />
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button
        type="submit"
        disabled={loading}
        className="h-11 rounded-full px-5 font-semibold shadow-md transition hover:shadow-lg"
      >
        {loading ? "Saving..." : "Create"}
      </Button>
    </form>
  );
}
