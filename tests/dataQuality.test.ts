import { describe, expect, it } from "vitest";
import { AssetStatus } from "@prisma/client";
import { buildIssuesFromAssets } from "@/server/audit/dataQuality";

describe("data quality issue detection", () => {
  const assets = [
    { id: "1", assetTag: "A-1", serialNumber: null, purchaseDate: new Date("2024-01-01"), warrantyEnd: new Date("2024-06-01"), status: AssetStatus.IN_STOCK, assignedToId: null },
    { id: "2", assetTag: "A-2", serialNumber: "SN-1", purchaseDate: new Date("2024-02-01"), warrantyEnd: new Date("2024-01-15"), status: AssetStatus.IN_STOCK, assignedToId: null },
    { id: "3", assetTag: "A-3", serialNumber: "SN-1", purchaseDate: null, warrantyEnd: null, status: AssetStatus.ASSIGNED, assignedToId: null },
    { id: "4", assetTag: "A-3", serialNumber: "SN-2", purchaseDate: null, warrantyEnd: null, status: AssetStatus.REPAIR, assignedToId: "person-1" },
    { id: "5", assetTag: "", serialNumber: "SN-3", purchaseDate: null, warrantyEnd: null, status: AssetStatus.ASSIGNED, assignedToId: null },
  ];

  it("detects missing serials, tags, duplicates, warranty order, and missing assignee", () => {
    const issues = buildIssuesFromAssets(assets);
    const types = issues.map((i) => i.type);

    expect(types).toContain("MISSING_SERIAL");
    expect(types).toContain("MISSING_ASSET_TAG");
    expect(types).toContain("WARRANTY_BEFORE_PURCHASE");
    expect(types).toContain("DUPLICATE_SERIAL");
    expect(types).toContain("DUPLICATE_ASSET_TAG");
    expect(types).toContain("ASSIGNED_WITHOUT_ASSIGNEE");

    const missingSerial = issues.find((i) => i.type === "MISSING_SERIAL");
    expect(missingSerial?.count).toBe(1);

    const duplicateSerial = issues.find((i) => i.type === "DUPLICATE_SERIAL");
    expect(duplicateSerial?.count).toBe(2);
  });
});
