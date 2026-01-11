import { describe, expect, it, vi } from "vitest";
import { AssetStatus } from "@prisma/client";
import { planSchema, ActionType } from "@/server/ai/actions/schemas";
import { planFromMessage } from "@/server/ai/actions/planFromMessage";
import { previewPlan } from "@/server/ai/actions/previewPlan";

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      asset: {
        findMany: vi.fn().mockResolvedValue([
          { id: "1", assetTag: "AS-1", status: "IN_STOCK", location: null, assignedToId: null },
        ]),
      },
    },
  };
});

describe("action plan schema", () => {
  it("rejects invalid payload fields", () => {
    const result = planSchema.safeParse({
      intent: "MANAGE_ASSETS",
      actions: [
        {
          type: ActionType.UPDATE_ASSET,
          selection: { assetIds: ["A-1"] },
          payload: { status: "INVALID" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("heuristic planner", () => {
  const workspaceId = "w1";
  const userId = "u1";

  const cases: { message: string; expectedType: ActionType }[] = [
    { message: "add asset tag AS-1001 laptop", expectedType: ActionType.CREATE_ASSET },
    { message: "assign AS-1001 to Lee", expectedType: ActionType.ASSIGN_ASSET },
    { message: "move AS-1001 to KL office", expectedType: ActionType.CHANGE_LOCATION },
    { message: "set status repair for AS-1001", expectedType: ActionType.UPDATE_ASSET },
    { message: "delete AS-1001", expectedType: ActionType.SOFT_DELETE_ASSET },
    { message: "bulk update assigned assets", expectedType: ActionType.ASSIGN_ASSET },
    { message: "change location to NYC for all repair assets", expectedType: ActionType.CHANGE_LOCATION },
    { message: "set status assigned", expectedType: ActionType.UPDATE_ASSET },
  ];

  for (const testCase of cases) {
    it(`parses "${testCase.message}"`, async () => {
      const plan = await planFromMessage({
        message: testCase.message,
        workspaceId,
        userId,
      });
      expect(plan.actions[0]?.type).toBe(testCase.expectedType);
    });
  }

  it("detects status field", async () => {
    const plan = await planFromMessage({
      message: "mark assets in stock",
      workspaceId,
      userId,
    });
    expect(plan.actions[0]?.payload?.status).toBe(AssetStatus.IN_STOCK);
  });

  it("detects assignee name and limitOne", async () => {
    const plan = await planFromMessage({
      message: "assign one monitor to Ariana",
      workspaceId,
      userId,
    });
    expect(plan.actions[0]?.type).toBe(ActionType.ASSIGN_ASSET);
    expect(plan.actions[0]?.limitOne).toBe(true);
    expect((plan.actions[0]?.payload as any)?.assignedToName).toBe("Ariana");
  });
});

describe("preview plan bulk cap", () => {
  it("requires confirmation when over 200 assets", async () => {
    const plan = {
      intent: "MANAGE_ASSETS",
      actions: [
        {
          type: ActionType.UPDATE_ASSET,
          selection: { assetIds: Array.from({ length: 250 }, (_, i) => `AS-${i}`) },
          payload: { status: AssetStatus.REPAIR },
        },
      ],
      requiresConfirmation: false,
    };

    const preview = await previewPlan(plan as any, "w1");
    expect(preview.requiresConfirmation).toBe(true);
  });
});
