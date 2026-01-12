export const ASSET_STATUSES = ["IN_STOCK", "ASSIGNED", "REPAIR", "RETIRED"] as const;
export type AssetStatusValue = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatusValue, string> = {
  IN_STOCK: "In Stock",
  ASSIGNED: "Assigned",
  REPAIR: "Repair",
  RETIRED: "Retired",
};

const normalizeAssetStatus = (value: string) => {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return normalized === "IN_USED" || normalized === "IN_USE" ? "ASSIGNED" : normalized;
};

export const getAssetStatusLabel = (status: AssetStatusValue | string) => {
  const normalized = normalizeAssetStatus(status);
  return ASSET_STATUS_LABELS[normalized as AssetStatusValue] ?? normalized.replace(/_/g, " ");
};

export const ROLES = ["ADMIN", "IT_STAFF", "VIEWER"] as const;
export type RoleValue = (typeof ROLES)[number];
