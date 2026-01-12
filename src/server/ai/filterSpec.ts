import { AssetStatus as Status } from "@prisma/client";
import { z } from "zod";

export { Status };

export enum SortBy {
  UPDATED = "UPDATED",
  CREATED = "CREATED",
  WARRANTY_END = "WARRANTY_END",
  PURCHASE_DATE = "PURCHASE_DATE",
}

export enum Direction {
  ASC = "ASC",
  DESC = "DESC",
}

const nonEmptyString = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.trim());

export const filterSpecSchema = z.object({
  search: nonEmptyString.optional(),
  assetTags: z.array(nonEmptyString).min(1).optional(),
  category: nonEmptyString.optional(),
  location: nonEmptyString.optional(),
  statuses: z.array(z.nativeEnum(Status)).min(1).optional(),
  assignedTo: nonEmptyString.optional(),
  warrantyExpiringInDays: z.coerce.number().int().min(1).max(365).optional(),
  purchasedWithinDays: z.coerce.number().int().min(1).max(3650).optional(),
  sortBy: z.nativeEnum(SortBy).optional(),
  direction: z.nativeEnum(Direction).optional(),
  limit: z.coerce.number().int().min(10).max(200).optional(),
});

export type FilterSpec = z.infer<typeof filterSpecSchema>;

function normalizeEnumValue<T extends string>(value: unknown, enumValues: readonly T[]): T | undefined {
  if (typeof value !== "string") return undefined;
  let normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_") as T;
  if ((normalized === ("IN_USED" as T) || normalized === ("IN_USE" as T)) && enumValues.includes("ASSIGNED" as T)) {
    normalized = "ASSIGNED" as T;
  }
  return enumValues.includes(normalized) ? normalized : undefined;
}

function clamp(value: unknown, min: number, max: number): number | undefined {
  const numValue = typeof value === "string" ? Number(value) : typeof value === "number" ? value : undefined;
  if (numValue === undefined || !Number.isFinite(numValue)) return undefined;
  return Math.min(Math.max(numValue, min), max);
}

export function normalizeFilterSpec(spec: Partial<FilterSpec> | null | undefined): FilterSpec {
  const normalized: Partial<FilterSpec> = {};

  const stringFields: (keyof FilterSpec)[] = ["search", "category", "location", "assignedTo"];
  for (const field of stringFields) {
    const value = spec?.[field];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        (normalized as Record<string, unknown>)[field] = trimmed;
      }
    }
  }

  if (Array.isArray(spec?.statuses)) {
    const deduped = Array.from(
      new Set(
        spec!.statuses
          .map((status) => normalizeEnumValue(status, Object.values(Status)))
          .filter(Boolean) as Status[],
      ),
    );
    if (deduped.length) {
      normalized.statuses = deduped;
    }
  }

  const sortBy = normalizeEnumValue(spec?.sortBy, Object.values(SortBy));
  if (sortBy) {
    normalized.sortBy = sortBy;
  }

  const direction = normalizeEnumValue(spec?.direction, Object.values(Direction));
  if (direction) {
    normalized.direction = direction;
  }

  if (Array.isArray(spec?.assetTags)) {
    const tags = spec.assetTags
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean);
    if (tags.length) {
      normalized.assetTags = Array.from(new Set(tags));
    }
  }

  const warrantyExpiringInDays = clamp(spec?.warrantyExpiringInDays, 1, 365);
  if (warrantyExpiringInDays) {
    normalized.warrantyExpiringInDays = warrantyExpiringInDays;
  }

  const purchasedWithinDays = clamp(spec?.purchasedWithinDays, 1, 3650);
  if (purchasedWithinDays) {
    normalized.purchasedWithinDays = purchasedWithinDays;
  }

  normalized.limit = clamp(spec?.limit, 10, 200) ?? 50;

  const parsed = filterSpecSchema.safeParse(normalized);
  if (parsed.success) {
    return { ...parsed.data, limit: parsed.data.limit ?? 50 };
  }

  // If parsing fails, return a minimal spec with defaults applied.
  return {
    search: normalized.search,
    assetTags: normalized.assetTags,
    category: normalized.category,
    location: normalized.location,
    statuses: normalized.statuses,
    assignedTo: normalized.assignedTo,
    warrantyExpiringInDays: normalized.warrantyExpiringInDays,
    purchasedWithinDays: normalized.purchasedWithinDays,
    sortBy: normalized.sortBy,
    direction: normalized.direction,
    limit: normalized.limit ?? 50,
  };
}
