import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effectiveRole, hasRequiredRole } from "@/lib/rbac";
import { ActionType } from "@/server/ai/actions/schemas";
import { filterSpecToAssetFilterInput } from "@/lib/ai";
import { resolveCategoryName } from "@/lib/categories";
import { AssetStatus, Role } from "@prisma/client";

type PlanRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  planJson: any;
  previewJson: any;
  requiresConfirmation: boolean;
  confirmationText?: string | null;
  expiresAt: Date;
  status: string;
};

function buildWhereFromSelection(workspaceId: string, selection: any) {
  if (selection.assetIds) {
    const cleaned = Array.from(
      new Set(
        (Array.isArray(selection.assetIds) ? (selection.assetIds as unknown[]) : [])
          .map((id: unknown) => String(id).trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (!cleaned.length) return { workspaceId, deletedAt: null };
    return {
      workspaceId,
      deletedAt: null,
      OR: [
        { id: { in: cleaned } },
        ...cleaned.map((tag: string) => ({ assetTag: { equals: tag, mode: "insensitive" as const } })),
      ],
    };
  }
  if (selection.filterSpec) {
    const filters = filterSpecToAssetFilterInput(selection.filterSpec);
    const where: any = { workspaceId, deletedAt: null };
    if (filters.q) where.assetTag = { contains: filters.q, mode: "insensitive" };
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };
    if (filters.location) where.location = { contains: filters.location, mode: "insensitive" };
    if (filters.assignedTo) {
      where.assignedTo = { name: { contains: filters.assignedTo, mode: "insensitive" } };
    }
    return where;
  }
  return { workspaceId, deletedAt: null };
}

async function auditLog(workspaceId: string, assetId: string, userId: string, action: string, changes?: any) {
  await prisma.assetActivity.create({
    data: {
      workspaceId,
      assetId,
      userId,
      action,
      changes: changes ? (changes as any) : undefined,
    },
  });
}

async function applyUpdates(workspaceId: string, userId: string, action: any, role: Role) {
  const where = buildWhereFromSelection(workspaceId, action.selection);
  const targets = await prisma.asset.findMany({
    where,
    select: {
      id: true,
      assetTag: true,
      status: true,
      category: true,
      location: true,
      assignedToId: true,
      purchaseDate: true,
      warrantyEnd: true,
      serialNumber: true,
      model: true,
      brand: true,
      notes: true,
      imeiNumber: true,
      deviceSpec: true,
      accessories: true,
    },
    take: action.limitOne ? 1 : 500,
  });

  if (!hasRequiredRole(role, Role.IT_STAFF)) {
    throw new Error("Insufficient role");
  }

  if (targets.length > 200 && !hasRequiredRole(role, Role.ADMIN)) {
    throw new Error("Too many assets matched; refine your request.");
  }

  const updates: string[] = [];
  const scopedTargets = action.limitOne ? targets.slice(0, 1) : targets;

  for (const asset of scopedTargets) {
    const data: any = {};
    if (action.payload.status) {
      const statusValue =
        action.payload.status === "IN_USED" || action.payload.status === "IN_USE"
          ? AssetStatus.ASSIGNED
          : action.payload.status;
      data.status = statusValue;
    } else if (action.type === ActionType.ASSIGN_ASSET) {
      data.status = AssetStatus.ASSIGNED;
    }
    if (action.payload.category) data.category = action.payload.category;
    if (action.payload.location) data.location = action.payload.location;
    if (action.payload.warrantyEnd) data.warrantyEnd = action.payload.warrantyEnd;
    if (action.payload.purchaseDate) data.purchaseDate = action.payload.purchaseDate;
    if (action.payload.serialNumber) data.serialNumber = action.payload.serialNumber;
    if (action.payload.model) data.model = action.payload.model;
    if (action.payload.brand) data.brand = action.payload.brand;
    if (action.payload.notes) data.notes = action.payload.notes;
    if (action.payload.imeiNumber) data.imeiNumber = action.payload.imeiNumber;
    if (action.payload.deviceSpec) data.deviceSpec = action.payload.deviceSpec;
    if (action.payload.accessories) data.accessories = action.payload.accessories;


    let assignedToId: string | null | undefined = action.payload.assignedToId;
    const assignedToName =
      typeof (action.payload as any).assignedToName === "string" ? (action.payload as any).assignedToName.trim() : "";

    if (typeof assignedToId === "string" && assignedToId.trim()) {
      const person = await prisma.person.findFirst({
        where: { id: assignedToId, workspaceId },
        select: { id: true },
      });
      if (!person) {
        throw new Error("Assignee not found in this workspace.");
      }
      assignedToId = person.id;
    }

    if (assignedToId === undefined && assignedToName) {
      const usernameCandidate = assignedToName.split("@")[0];
      const candidates = await prisma.person.findMany({
        where: {
          workspaceId,
          OR: [
            { name: { equals: assignedToName, mode: "insensitive" } },
            usernameCandidate
              ? { name: { equals: usernameCandidate, mode: "insensitive" } }
              : undefined,
            usernameCandidate ? { email: { startsWith: `${usernameCandidate}@`, mode: "insensitive" } } : undefined,
            { email: { equals: assignedToName, mode: "insensitive" } },
          ].filter(Boolean) as any,
        },
        select: { id: true, name: true, email: true },
        take: 2,
      });

      if (candidates.length === 1) {
        assignedToId = candidates[0].id;
      } else if (candidates.length > 1) {
        throw new Error(`Multiple matches for assignee "${assignedToName}". Please specify the email.`);
      } else {
        throw new Error(`Assignee "${assignedToName}" not found in this workspace.`);
      }
    }

    if (assignedToId !== undefined) {
      data.assignedToId = assignedToId ?? null;
    }
    if (Object.keys(data).length === 0) continue;

    if (data.category) {
      const categoryName = await resolveCategoryName(workspaceId, data.category);
      data.category = categoryName;
    }

    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data,
    });

    const changes: Record<string, { before: any; after: any }> = {};
    for (const key of Object.keys(data)) {
      const before = (asset as any)[key];
      const after = (updated as any)[key];
      if (before !== after) {
        changes[key] = { before, after };
      }
    }
    await auditLog(workspaceId, asset.id, userId, "AI update", changes);
    updates.push(asset.id);
  }

  return { count: updates.length, assetIds: updates };
}

async function applySoftDelete(workspaceId: string, userId: string, action: any, role: Role) {
  if (!hasRequiredRole(role, Role.ADMIN)) {
    throw new Error("Only admins can delete assets");
  }
  const where = buildWhereFromSelection(workspaceId, action.selection);
  const targets = await prisma.asset.findMany({
    where,
    select: { id: true, assetTag: true },
    take: action.limitOne ? 1 : undefined,
  });

  const ids = targets.map((t) => t.id);
  if (!ids.length) return { count: 0, assetIds: [] };

  await prisma.asset.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: new Date() },
  });

  for (const id of ids) {
    await auditLog(workspaceId, id, userId, "AI soft delete");
  }

  return { count: ids.length, assetIds: ids };
}

async function applyCreate(workspaceId: string, userId: string, action: any, role: Role) {
  if (!hasRequiredRole(role, Role.IT_STAFF)) {
    throw new Error("Insufficient role");
  }

  let tags = action.selection.assetIds ?? [];
  if (!tags.length) {
    throw new Error("Provide asset tags to create.");
  }
  if (action.limitOne && tags.length > 1) {
    tags = tags.slice(0, 1);
  }

  const createdIds: string[] = [];
  for (const tag of tags) {
    const categoryName = action.payload.category
      ? await resolveCategoryName(workspaceId, action.payload.category)
      : undefined;
    const asset = await prisma.asset.create({
      data: {
        assetTag: tag,
        workspaceId,
        status: action.payload.status ?? undefined,
        category: categoryName ?? undefined,
        location: action.payload.location ?? undefined,
        assignedToId: action.payload.assignedToId ?? undefined,
        warrantyEnd: action.payload.warrantyEnd ?? undefined,
        purchaseDate: action.payload.purchaseDate ?? undefined,
        serialNumber: action.payload.serialNumber ?? undefined,
        model: action.payload.model ?? undefined,
        brand: action.payload.brand ?? undefined,
        notes: action.payload.notes ?? undefined,
      },
    });
    await auditLog(workspaceId, asset.id, userId, "AI create asset");
    createdIds.push(asset.id);
  }

  return { count: createdIds.length, assetIds: createdIds };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = typeof body?.planId === "string" ? body.planId : "";
  const confirm = Boolean(body?.confirm);
  const confirmationText = typeof body?.confirmationText === "string" ? body.confirmationText : "";

  if (!planId || !confirm) {
    return NextResponse.json({ error: "planId and confirm are required" }, { status: 400 });
  }

  const record = (await prisma.aiActionPlan.findUnique({
    where: { id: planId },
  })) as PlanRecord | null;

  if (!record) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (record.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (record.status !== "PENDING") {
    return NextResponse.json({ error: "Plan already processed" }, { status: 400 });
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Plan expired" }, { status: 400 });
  }

  if (record.requiresConfirmation && record.confirmationText && record.confirmationText !== confirmationText) {
    return NextResponse.json({ error: "Confirmation text does not match" }, { status: 400 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: record.workspaceId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = effectiveRole(session.user.role as Role, membership.role);
  if (!hasRequiredRole(role, Role.IT_STAFF)) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }
  const plan = record.planJson;
  const results: { action: any; result: { count: number; assetIds: string[] } }[] = [];

  try {
    await prisma.$transaction(async () => {
      for (const action of plan.actions as any[]) {
        let result = { count: 0, assetIds: [] as string[] };
        if (action.type === ActionType.CREATE_ASSET) {
          result = await applyCreate(record.workspaceId, session.user.id, action, role);
        } else if (
          action.type === ActionType.UPDATE_ASSET ||
          action.type === ActionType.ASSIGN_ASSET ||
          action.type === ActionType.CHANGE_LOCATION ||
          action.type === ActionType.BULK_UPDATE
        ) {
          result = await applyUpdates(record.workspaceId, session.user.id, action, role);
        } else if (action.type === ActionType.SOFT_DELETE_ASSET) {
          result = await applySoftDelete(record.workspaceId, session.user.id, action, role);
        }
        results.push({ action, result });
      }

      await prisma.aiActionPlan.update({
        where: { id: planId },
        data: { status: "EXECUTED" },
      });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Execution failed" }, { status: 400 });
  }

  const total = results.reduce((sum, item) => sum + (item.result?.count || 0), 0);
  const affectedAssetIds = results.flatMap((item) => item.result.assetIds || []);

  return NextResponse.json({
    success: true,
    affectedCount: total,
    affectedAssetIds,
  });
}





