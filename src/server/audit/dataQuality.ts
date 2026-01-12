import { AssetStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { assetFilterSchema, type AssetFilterInput } from "@/lib/validators";

export type AuditIssueType =
  | "MISSING_SERIAL"
  | "MISSING_ASSET_TAG"
  | "MISSING_CATEGORY"
  | "MISSING_BRAND"
  | "MISSING_MODEL"
  | "MISSING_LOCATION"
  | "MISSING_PURCHASE_DATE"
  | "MISSING_WARRANTY_END"
  | "WARRANTY_BEFORE_PURCHASE"
  | "DUPLICATE_SERIAL"
  | "DUPLICATE_ASSET_TAG"
  | "ASSIGNED_WITHOUT_ASSIGNEE"
  | "MISSING_IMEI"
  | "MISSING_DEVICE_SPEC"
  | "MISSING_ACCESSORIES";

export type AuditIssue = {
  type: AuditIssueType;
  count: number;
  examples: { assetId: string; assetTag: string | null }[];
  suggestion: string;
};

type AuditOptions = {
  filters?: Partial<AssetFilterInput>;
};

type SlimAsset = {
  id: string;
  assetTag: string | null;
  serialNumber: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  location?: string | null;
  imeiNumber?: string | null;
  deviceSpec?: string | null;
  accessories?: string | null;
  purchaseDate: Date | null;
  warrantyEnd: Date | null;
  status: AssetStatus;
  assignedToId: string | null;
};

const suggestionMap: Record<AuditIssueType, string> = {
  MISSING_SERIAL: "Add serial numbers for tracking and warranty lookups.",
  MISSING_ASSET_TAG: "Assign a unique asset tag to each asset.",
  MISSING_CATEGORY: "Add a category for reporting and filtering.",
  MISSING_BRAND: "Add a brand for inventory reporting.",
  MISSING_MODEL: "Add a model for inventory reporting.",
  MISSING_LOCATION: "Add a location to know where the asset is.",
  MISSING_PURCHASE_DATE: "Add a purchase date for lifecycle tracking.",
  MISSING_WARRANTY_END: "Add a warranty end date for coverage tracking.",
  WARRANTY_BEFORE_PURCHASE: "Fix purchase/warranty dates so warrantyEnd is after purchaseDate.",
  DUPLICATE_SERIAL: "Resolve duplicate serial numbers to ensure uniqueness.",
  DUPLICATE_ASSET_TAG: "Resolve duplicate asset tags to ensure uniqueness.",
  ASSIGNED_WITHOUT_ASSIGNEE: "Assign these assets to a person or move them out of Assigned status.",
  MISSING_IMEI: "Add IMEI numbers for iPads to track devices accurately.",
  MISSING_DEVICE_SPEC: "Add device specs (storage/connectivity) for iPads.",
  MISSING_ACCESSORIES: "Add included accessories for iPads so kits can be tracked.",
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() || "";
}

export function buildIssuesFromAssets(assets: SlimAsset[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  const missingSerial = assets.filter((asset) => !normalizeString(asset.serialNumber));
  if (missingSerial.length) {
    issues.push({
      type: "MISSING_SERIAL",
      count: missingSerial.length,
      examples: missingSerial.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_SERIAL,
    });
  }

  const missingTag = assets.filter((asset) => !normalizeString(asset.assetTag));
  if (missingTag.length) {
    issues.push({
      type: "MISSING_ASSET_TAG",
      count: missingTag.length,
      examples: missingTag.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_ASSET_TAG,
    });
  }

  const missingCategory = assets.filter((asset) => !normalizeString(asset.category ?? null));
  if (missingCategory.length) {
    issues.push({
      type: "MISSING_CATEGORY",
      count: missingCategory.length,
      examples: missingCategory.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_CATEGORY,
    });
  }

  const missingBrand = assets.filter((asset) => !normalizeString(asset.brand ?? null));
  if (missingBrand.length) {
    issues.push({
      type: "MISSING_BRAND",
      count: missingBrand.length,
      examples: missingBrand.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_BRAND,
    });
  }

  const missingModel = assets.filter((asset) => !normalizeString(asset.model ?? null));
  if (missingModel.length) {
    issues.push({
      type: "MISSING_MODEL",
      count: missingModel.length,
      examples: missingModel.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_MODEL,
    });
  }

  const missingLocation = assets.filter((asset) => !normalizeString(asset.location ?? null));
  if (missingLocation.length) {
    issues.push({
      type: "MISSING_LOCATION",
      count: missingLocation.length,
      examples: missingLocation.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_LOCATION,
    });
  }

  const missingPurchaseDate = assets.filter((asset) => !asset.purchaseDate);
  if (missingPurchaseDate.length) {
    issues.push({
      type: "MISSING_PURCHASE_DATE",
      count: missingPurchaseDate.length,
      examples: missingPurchaseDate.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_PURCHASE_DATE,
    });
  }

  const missingWarrantyEnd = assets.filter((asset) => !asset.warrantyEnd);
  if (missingWarrantyEnd.length) {
    issues.push({
      type: "MISSING_WARRANTY_END",
      count: missingWarrantyEnd.length,
      examples: missingWarrantyEnd.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_WARRANTY_END,
    });
  }

  const warrantyBeforePurchase = assets.filter(
    (asset) => asset.warrantyEnd && asset.purchaseDate && asset.warrantyEnd < asset.purchaseDate,
  );
  if (warrantyBeforePurchase.length) {
    issues.push({
      type: "WARRANTY_BEFORE_PURCHASE",
      count: warrantyBeforePurchase.length,
      examples: warrantyBeforePurchase.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.WARRANTY_BEFORE_PURCHASE,
    });
  }

  const serialBuckets = new Map<string, SlimAsset[]>();
  for (const asset of assets) {
    const key = normalizeString(asset.serialNumber).toLowerCase();
    if (!key) continue;
    const bucket = serialBuckets.get(key) ?? [];
    bucket.push(asset);
    serialBuckets.set(key, bucket);
  }
  const duplicateSerials = Array.from(serialBuckets.values()).filter((bucket) => bucket.length > 1);
  if (duplicateSerials.length) {
    const dupAssets = duplicateSerials.flat();
    issues.push({
      type: "DUPLICATE_SERIAL",
      count: dupAssets.length,
      examples: dupAssets.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.DUPLICATE_SERIAL,
    });
  }

  const tagBuckets = new Map<string, SlimAsset[]>();
  for (const asset of assets) {
    const key = normalizeString(asset.assetTag).toLowerCase();
    if (!key) continue;
    const bucket = tagBuckets.get(key) ?? [];
    bucket.push(asset);
    tagBuckets.set(key, bucket);
  }
  const duplicateTags = Array.from(tagBuckets.values()).filter((bucket) => bucket.length > 1);
  if (duplicateTags.length) {
    const dupAssets = duplicateTags.flat();
    issues.push({
      type: "DUPLICATE_ASSET_TAG",
      count: dupAssets.length,
      examples: dupAssets.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.DUPLICATE_ASSET_TAG,
    });
  }

  const assignedWithoutAssignee = assets.filter((asset) => asset.status === AssetStatus.ASSIGNED && !asset.assignedToId);
  if (assignedWithoutAssignee.length) {
    issues.push({
      type: "ASSIGNED_WITHOUT_ASSIGNEE",
      count: assignedWithoutAssignee.length,
      examples: assignedWithoutAssignee.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.ASSIGNED_WITHOUT_ASSIGNEE,
    });
  }

  const missingImei = assets.filter((asset) => {
    const cat = normalizeString(asset.category).toLowerCase();
    const isIpad = cat.includes("ipad");
    return isIpad && !normalizeString(asset.imeiNumber);
  });
  if (missingImei.length) {
    issues.push({
      type: "MISSING_IMEI",
      count: missingImei.length,
      examples: missingImei.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_IMEI,
    });
  }

  const missingDeviceSpec = assets.filter((asset) => {
    const cat = normalizeString(asset.category).toLowerCase();
    const isIpad = cat.includes("ipad");
    return isIpad && !normalizeString(asset.deviceSpec);
  });
  if (missingDeviceSpec.length) {
    issues.push({
      type: "MISSING_DEVICE_SPEC",
      count: missingDeviceSpec.length,
      examples: missingDeviceSpec.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_DEVICE_SPEC,
    });
  }

  const missingAccessories = assets.filter((asset) => {
    const cat = normalizeString(asset.category).toLowerCase();
    const isIpad = cat.includes("ipad");
    return isIpad && !normalizeString(asset.accessories);
  });
  if (missingAccessories.length) {
    issues.push({
      type: "MISSING_ACCESSORIES",
      count: missingAccessories.length,
      examples: missingAccessories.slice(0, 8).map((a) => ({ assetId: a.id, assetTag: a.assetTag })),
      suggestion: suggestionMap.MISSING_ACCESSORIES,
    });
  }

  return issues;
}

function buildWhere(workspaceId: string, rawFilters?: Partial<AssetFilterInput>) {
  const parsed = assetFilterSchema.safeParse(rawFilters ?? {});
  const filters = parsed.success ? parsed.data : {};

  const where: any = { workspaceId, deletedAt: null };
  const andClauses: any[] = [];

  if (filters.status?.length) where.status = { in: filters.status };
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };
  if (filters.location) where.location = { contains: filters.location, mode: "insensitive" };
  if (filters.assignedTo) {
    where.assignedTo = { name: { contains: filters.assignedTo, mode: "insensitive" } };
  }

  if (filters.q) {
    andClauses.push({
      OR: [
        { assetTag: { contains: filters.q, mode: "insensitive" } },
        { serialNumber: { contains: filters.q, mode: "insensitive" } },
        { brand: { contains: filters.q, mode: "insensitive" } },
        { model: { contains: filters.q, mode: "insensitive" } },
        { location: { contains: filters.q, mode: "insensitive" } },
        { category: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  const now = new Date();
  if (filters.warrantyExpiringInDays) {
    andClauses.push({
      warrantyEnd: { gte: now, lte: addDays(now, filters.warrantyExpiringInDays) },
    });
  }

  if (filters.purchasedWithinDays) {
    andClauses.push({
      purchaseDate: { gte: addDays(now, -filters.purchasedWithinDays) },
    });
  }

  if (andClauses.length) {
    where.AND = andClauses;
  }

  return where;
}

export async function auditDataQuality(workspaceId: string, options?: AuditOptions) {
  const where = buildWhere(workspaceId, options?.filters);

  const assets = await prisma.asset.findMany({
    where,
    select: {
      id: true,
      assetTag: true,
      serialNumber: true,
      brand: true,
      model: true,
      location: true,
      imeiNumber: true,
      category: true,
      deviceSpec: true,
      accessories: true,
      purchaseDate: true,
      warrantyEnd: true,
      status: true,
      assignedToId: true,
    },
  });

  return {
    issues: buildIssuesFromAssets(assets),
    generatedAt: new Date().toISOString(),
  };
}
