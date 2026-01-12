import { prisma } from "@/lib/prisma";
import { filterSpecToAssetFilterInput } from "@/lib/ai";
import { ActionPlan, ActionItem, ActionType } from "./schemas";

type PreviewAction = ActionItem & {
  affectedCount: number;
  sample: { id: string; assetTag: string | null; status: string; location: string | null; assignedToId: string | null }[];
};

export type PlanPreview = {
  actions: PreviewAction[];
  requiresConfirmation: boolean;
  confirmationText?: string;
};

async function resolveSelection(workspaceId: string, action: ActionItem) {
  if ("assetIds" in action.selection) {
    const rawIds = action.selection.assetIds ?? [];
    const cleaned = Array.from(new Set(rawIds.map((id) => id.trim()).filter(Boolean)));
    if (!cleaned.length) return [];

    if (action.type === ActionType.CREATE_ASSET) {
      return (action as any).limitOne ? cleaned.slice(0, 1) : cleaned;
    }

    const assets = await prisma.asset.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [
          { id: { in: cleaned } },
          ...cleaned.map((tag) => ({ assetTag: { equals: tag, mode: "insensitive" as const } })),
        ],
      },
      select: { id: true },
      take: 500,
    });

    let ids = assets.map((asset) => asset.id);
    if ((action as any).limitOne && ids.length > 1) {
      ids = ids.slice(0, 1);
    }
    return ids;
  }

  const filters = filterSpecToAssetFilterInput(action.selection.filterSpec as any);
  const assets = await prisma.asset.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(filters.q ? { assetTag: { contains: filters.q, mode: "insensitive" } } : {}),
      ...(filters.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters.category ? { category: { contains: filters.category, mode: "insensitive" } } : {}),
      ...(filters.location ? { location: { contains: filters.location, mode: "insensitive" } } : {}),
      ...(filters.assignedTo
        ? { assignedTo: { name: { contains: filters.assignedTo, mode: "insensitive" } } }
        : {}),
    },
    select: { id: true },
    take: 500,
  });

  let ids = assets.map((a) => a.id);
  if ((action as any).limitOne && ids.length > 1) {
    ids = ids.slice(0, 1);
  }
  return ids;
}

function computeDiffSample(sample: PreviewAction["sample"], payload: ActionItem["payload"]) {
  return sample.map((item) => ({
    before: {
      status: item.status,
      location: item.location,
      assignedToId: item.assignedToId,
    },
    after: {
      status: payload.status ?? item.status,
      location: payload.location ?? item.location,
      assignedToId: payload.assignedToId ?? item.assignedToId,
    },
  }));
}

export async function previewPlan(plan: ActionPlan, workspaceId: string): Promise<PlanPreview> {
  const previews: PreviewAction[] = [];
  let requiresConfirmation = plan.requiresConfirmation;
  let confirmationText = plan.confirmationText;

  for (const action of plan.actions) {
    const ids = await resolveSelection(workspaceId, action);
    if (!ids.length) {
      previews.push({ ...action, affectedCount: 0, sample: [] });
      continue;
    }

    const assets = await prisma.asset.findMany({
      where: { workspaceId, id: { in: ids }, deletedAt: null },
      select: { id: true, assetTag: true, status: true, location: true, assignedToId: true },
      take: 5,
    });

    if (
      ids.length > 200 ||
      action.type === ActionType.SOFT_DELETE_ASSET ||
      plan.requiresConfirmation
    ) {
      requiresConfirmation = true;
      confirmationText = confirmationText || `CONFIRM ${ids.length}`;
    }

    previews.push({
      ...action,
      affectedCount: ids.length,
      sample: assets,
    });
  }

  return {
    actions: previews,
    requiresConfirmation,
    confirmationText,
  };
}
