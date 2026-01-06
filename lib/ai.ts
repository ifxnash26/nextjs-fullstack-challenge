import { AssetStatus } from "@prisma/client";
import { FilterSpec } from "./validators";

const statusKeywords: Record<AssetStatus, string[]> = {
  [AssetStatus.IN_STOCK]: ["in stock", "available", "inventory"],
  [AssetStatus.ASSIGNED]: ["assigned", "checked out", "in use"],
  [AssetStatus.REPAIR]: ["repair", "fix", "broken"],
  [AssetStatus.RETIRED]: ["retired", "decommissioned", "disposed"],
};

export function deriveFiltersFromText(text: string): FilterSpec {
  const normalized = text.toLowerCase();
  const statuses: AssetStatus[] = [];

  for (const [status, keywords] of Object.entries(statusKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      statuses.push(status as AssetStatus);
    }
  }

  const vendorMatch = normalized.match(/from ([a-z0-9\s]+)/);
  const locationMatch = normalized.match(/in ([a-z0-9\s]+) office/);

  const spec: FilterSpec = {};
  if (statuses.length) spec.statuses = Array.from(new Set(statuses));
  if (vendorMatch) spec.vendor = vendorMatch[1].trim();
  if (locationMatch) spec.location = locationMatch[1].trim();

  const cleaned = normalized
    .replace(/(in stock|available|assigned|repair|retired|decommissioned|broken|disposed)/g, "")
    .replace(/from [a-z0-9\s]+/g, "")
    .replace(/in [a-z0-9\s]+ office/g, "")
    .trim();
  if (cleaned) {
    spec.search = cleaned;
  }

  return spec;
}

export function summarizeAssetContent(notes: string | null | undefined, activity: { action: string; createdAt: Date }[]) {
  const recent = activity
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
    .map((item) => `${item.action} (${item.createdAt.toDateString()})`)
    .join("; ");

  if (!process.env.AI_API_KEY) {
    return `Summary (offline): ${notes?.slice(0, 140) ?? "No notes yet"}. Recent: ${recent || "no activity logged"}.`;
  }

  // Placeholder until a model call is wired up.
  return `Summary: ${notes?.slice(0, 200) ?? "No notes yet."} Recent events: ${recent || "none recorded"}.`;
}
