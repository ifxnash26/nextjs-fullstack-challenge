export const ASSET_STATUSES = ["IN_STOCK", "ASSIGNED", "REPAIR", "RETIRED"] as const;
export type AssetStatusValue = (typeof ASSET_STATUSES)[number];

export const ROLES = ["ADMIN", "IT_STAFF", "VIEWER"] as const;
export type RoleValue = (typeof ROLES)[number];
