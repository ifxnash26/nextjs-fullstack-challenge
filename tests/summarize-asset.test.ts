import { describe, expect, it, beforeEach, vi } from "vitest";
import { AssetStatus } from "@prisma/client";
import { fallbackSummary, type SummaryContext } from "@/server/ai/summarizeAsset";

describe("fallback summary", () => {
  const baseContext: SummaryContext = {
    asset: {
      id: "a1",
      assetTag: "AS-1",
      category: "laptop",
      status: AssetStatus.REPAIR,
      assignee: "Jane Doe",
      location: "HQ",
      purchaseDate: new Date("2024-01-01"),
      warrantyEnd: new Date("2024-02-01"),
      updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      serialNumber: null,
    },
    activities: [
      { action: "Moved to repair", createdAt: new Date("2024-01-15"), changes: null },
      { action: "Assigned to Jane", createdAt: new Date("2024-01-10"), changes: null },
    ],
    notes: "Screen cracked.\nawaiting parts.\nsecret: should be redacted.",
  };

  it("builds deterministic bullets and risks", () => {
    const result = fallbackSummary(baseContext);
    expect(result.summaryBullets.length).toBeGreaterThanOrEqual(4);
    expect(result.summaryBullets.join(" ")).toContain("Status: REPAIR");
    expect(result.summaryBullets.join(" ")).toContain("Warranty");
    expect(result.riskFlags).toContain("Warranty expired");
    expect(result.riskFlags).toContain("In repair > 14 days");
    expect(result.riskFlags).toContain("Missing serial number");
  });
});

describe("summarize route access control", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 403 when workspace access is denied", async () => {
    const mockSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
    vi.doMock("next-auth/next", () => ({ getServerSession: mockSession }));
    vi.doMock("@/lib/auth", () => ({ authOptions: {} }));
    vi.doMock("@/server/ai/summarizeAsset", () => ({
      getAssetSummaryContext: vi.fn().mockRejectedValue(new Error("Workspace access denied")),
      summarizeAsset: vi.fn(),
    }));

    const request = new Request("http://localhost/api/ai/summarize-asset", {
      method: "POST",
      body: JSON.stringify({ workspaceId: "w1", assetId: "a1" }),
    });

    const { POST } = await import("@/app/api/ai/summarize-asset/route");
    const res = await POST(request);
    expect(res.status).toBe(403);
  });
});
