import { describe, expect, it, vi, beforeEach } from "vitest";
import { AssetStatus, Role } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  asset: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  assetActivity: {
    create: vi.fn(),
  },
}));

const getWorkspaceMembershipMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/workspaces", () => ({ getWorkspaceMembership: getWorkspaceMembershipMock }));

import { createAsset, updateAsset } from "@/lib/assets";

describe("asset service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", role: Role.ADMIN });
    getWorkspaceMembershipMock.mockResolvedValue({ role: Role.IT_STAFF });
  });

  it("creates an asset and logs activity", async () => {
    prismaMock.asset.create.mockResolvedValue({ id: "asset-1", assetTag: "AS-1" });
    prismaMock.assetActivity.create.mockResolvedValue({});

    const result = await createAsset("workspace-1", "user-1", { assetTag: "AS-1", status: AssetStatus.IN_STOCK });

    expect(result.id).toBe("asset-1");
    expect(prismaMock.asset.create).toHaveBeenCalled();
    expect(prismaMock.assetActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "Asset created", workspaceId: "workspace-1" }),
      }),
    );
  });

  it("updates an asset and records changes", async () => {
    prismaMock.asset.findFirst.mockResolvedValue({
      id: "asset-1",
      assetTag: "AS-1",
      status: AssetStatus.IN_STOCK,
      location: "NYC",
    });
    prismaMock.asset.update.mockResolvedValue({
      id: "asset-1",
      assetTag: "AS-1",
      status: AssetStatus.ASSIGNED,
      location: "Remote",
    });
    prismaMock.assetActivity.create.mockResolvedValue({});

    await updateAsset("workspace-1", "user-1", "asset-1", {
      status: AssetStatus.ASSIGNED,
      location: "Remote",
    });

    expect(prismaMock.asset.update).toHaveBeenCalled();
    expect(prismaMock.assetActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "Asset updated", workspaceId: "workspace-1" }),
      }),
    );
  });
});
