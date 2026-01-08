import { AssetStatus, Role } from "@prisma/client";
import { Parser as CsvParser } from "json2csv";
import { parse } from "csv-parse/sync";
import { prisma } from "./prisma";
import { AssetFilterInput, AssetInput, AssetUpdateInput, assetFilterSchema, assetInputSchema } from "./validators";
import { canEditAssets, effectiveRole, hasRequiredRole } from "./rbac";
import { getWorkspaceMembership } from "./workspaces";

function buildAssetWhere(workspaceId: string, filters: AssetFilterInput) {
  const parsed = assetFilterSchema.safeParse(filters);
  const data = parsed.success ? parsed.data : {};
  const where: any = { workspaceId };

  if (data.status?.length) {
    where.status = { in: data.status };
  }

  if (data.assetTags?.length) {
    where.assetTag = { in: data.assetTags };
  }

  if (data.category) where.category = { contains: data.category, mode: "insensitive" };
  if (data.brand) where.brand = { contains: data.brand, mode: "insensitive" };
  if (data.model) where.model = { contains: data.model, mode: "insensitive" };
  if (data.location) where.location = { contains: data.location, mode: "insensitive" };
  if (data.vendor) where.vendor = { contains: data.vendor, mode: "insensitive" };
  if (data.assignedTo) {
    where.assignedTo = { name: { contains: data.assignedTo, mode: "insensitive" } };
  }

  if (data.q) {
    where.OR = [
      { assetTag: { contains: data.q, mode: "insensitive" } },
      { serialNumber: { contains: data.q, mode: "insensitive" } },
      { brand: { contains: data.q, mode: "insensitive" } },
      { model: { contains: data.q, mode: "insensitive" } },
      { notes: { contains: data.q, mode: "insensitive" } },
      { location: { contains: data.q, mode: "insensitive" } },
    ];
  }

  return { where, data };
}

export async function listAssets(workspaceId: string, filters: AssetFilterInput) {
  const { where, data } = buildAssetWhere(workspaceId, filters);
  const orderBy = data.sort
    ? { [data.sort]: data.direction ?? "desc" }
    : { updatedAt: "desc" as const };

  return prisma.asset.findMany({
    where,
    orderBy,
    include: {
      assignedTo: true,
      activities: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
}

export async function getAsset(workspaceId: string, assetId: string) {
  return prisma.asset.findFirst({
    where: { id: assetId, workspaceId },
    include: {
      assignedTo: true,
      activities: { orderBy: { createdAt: "desc" }, take: 15, include: { user: true } },
    },
  });
}

async function logActivity(assetId: string, workspaceId: string, action: string, userId?: string, changes?: Record<string, unknown>) {
  await prisma.assetActivity.create({
    data: {
      assetId,
      workspaceId,
      userId,
      action,
      changes: changes ? (changes as any) : undefined,
    },
  });
}

async function getEffectiveRole(userId: string, workspaceId: string) {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getWorkspaceMembership(userId, workspaceId),
  ]);
  if (!user || !membership) {
    throw new Error("Workspace access denied");
  }

  return { membership, role: effectiveRole(user.role, membership.role) };
}

async function createAssetRecord(workspaceId: string, userId: string, parsedInput: AssetInput) {
  const asset = await prisma.asset.create({
    data: {
      ...parsedInput,
      workspaceId,
    },
    include: { assignedTo: true },
  });

  await logActivity(asset.id, workspaceId, "Asset created", userId, parsedInput);
  return asset;
}

async function updateAssetRecord(
  workspaceId: string,
  userId: string,
  assetId: string,
  parsedInput: Partial<AssetInput>,
) {
  const existing = await prisma.asset.findFirst({ where: { id: assetId, workspaceId } });
  if (!existing) {
    throw new Error("Asset not found");
  }

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: parsedInput,
    include: { assignedTo: true },
  });

  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(parsedInput)) {
    const typedKey = key as keyof AssetUpdateInput;
    const before = (existing as any)[typedKey];
    const after = (updated as any)[typedKey];
    if (before !== after) {
      changes[typedKey] = { before, after };
    }
  }
  if (Object.keys(changes).length) {
    await logActivity(assetId, workspaceId, "Asset updated", userId, changes);
  }

  return updated;
}

export async function createAsset(workspaceId: string, userId: string, input: AssetInput) {
  const { role } = await getEffectiveRole(userId, workspaceId);
  if (!canEditAssets(role)) {
    throw new Error("Insufficient role");
  }

  const parsed = assetInputSchema.parse(input);
  return createAssetRecord(workspaceId, userId, parsed);
}

export async function updateAsset(workspaceId: string, userId: string, assetId: string, input: Partial<AssetInput>) {
  const { role } = await getEffectiveRole(userId, workspaceId);
  if (!canEditAssets(role)) {
    throw new Error("Insufficient role");
  }
  const parsed = assetInputSchema.partial().parse(input);
  return updateAssetRecord(workspaceId, userId, assetId, parsed);
}

export async function deleteAsset(workspaceId: string, userId: string, assetId: string) {
  const { role } = await getEffectiveRole(userId, workspaceId);
  if (!hasRequiredRole(role, Role.ADMIN)) {
    throw new Error("Only admins can delete assets");
  }

  const asset = await prisma.asset.delete({
    where: { id: assetId },
  });
  return asset;
}

export async function previewAssetsForUpdate(workspaceId: string, filters: AssetFilterInput) {
  const { where } = buildAssetWhere(workspaceId, filters);
  const [count, sample] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      select: { assetTag: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  return { count, sample };
}

export async function findExistingAssetTags(workspaceId: string, tags: string[]) {
  if (!tags.length) return [];
  const existing = await prisma.asset.findMany({
    where: { workspaceId, assetTag: { in: tags } },
    select: { assetTag: true },
  });
  return existing.map((asset) => asset.assetTag);
}

export async function bulkCreateAssets(workspaceId: string, userId: string, assets: AssetInput[]) {
  const { role } = await getEffectiveRole(userId, workspaceId);
  if (!canEditAssets(role)) {
    throw new Error("Insufficient role");
  }

  const parsedAssets = assets.map((asset) => assetInputSchema.parse(asset));
  const tags = parsedAssets.map((asset) => asset.assetTag);
  const uniqueTags = new Set(tags);
  if (uniqueTags.size !== tags.length) {
    const duplicates = tags.filter((tag, index) => tags.indexOf(tag) !== index);
    throw new Error(`Duplicate asset tags in request: ${Array.from(new Set(duplicates)).join(", ")}`);
  }

  const existing = await findExistingAssetTags(workspaceId, tags);
  if (existing.length) {
    throw new Error(`Asset tags already exist: ${existing.join(", ")}`);
  }

  const created: string[] = [];
  for (const asset of parsedAssets) {
    await createAssetRecord(workspaceId, userId, asset);
    created.push(asset.assetTag);
  }

  return { count: created.length, created };
}

export async function bulkUpdateAssets(
  workspaceId: string,
  userId: string,
  filters: AssetFilterInput,
  updates: Partial<AssetInput>,
) {
  const { role } = await getEffectiveRole(userId, workspaceId);
  if (!canEditAssets(role)) {
    throw new Error("Insufficient role");
  }

  const parsedUpdates = assetInputSchema.partial().parse(updates);
  const { where } = buildAssetWhere(workspaceId, filters);
  const assets = await prisma.asset.findMany({
    where,
    select: { id: true, assetTag: true },
  });

  const updated: string[] = [];
  for (const asset of assets) {
    await updateAssetRecord(workspaceId, userId, asset.id, parsedUpdates);
    updated.push(asset.assetTag);
  }

  return { count: updated.length, updated };
}

export async function bulkDeleteAssets(workspaceId: string, userId: string, filters: AssetFilterInput) {
  const { role } = await getEffectiveRole(userId, workspaceId);
  if (!hasRequiredRole(role, Role.ADMIN)) {
    throw new Error("Only admins can delete assets");
  }

  const { where } = buildAssetWhere(workspaceId, filters);
  const assets = await prisma.asset.findMany({
    where,
    select: { id: true, assetTag: true },
  });

  const deleted: string[] = [];
  for (const asset of assets) {
    await deleteAsset(workspaceId, userId, asset.id);
    deleted.push(asset.assetTag);
  }

  return { count: deleted.length, deleted };
}

export async function importAssetsFromCsv(workspaceId: string, userId: string, csvText: string) {
  const { role } = await getEffectiveRole(userId, workspaceId);
  if (!canEditAssets(role)) {
    throw new Error("Insufficient role");
  }

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const created: string[] = [];
  const updated: string[] = [];

  for (const record of records) {
    const payload: AssetInput = {
      assetTag: record.assetTag,
      serialNumber: record.serialNumber || undefined,
      category: record.category || undefined,
      brand: record.brand || undefined,
      model: record.model || undefined,
      status: (record.status?.toUpperCase() as AssetStatus) || AssetStatus.IN_STOCK,
      location: record.location || undefined,
      vendor: record.vendor || undefined,
      purchaseDate: record.purchaseDate ? new Date(record.purchaseDate) : undefined,
      warrantyEnd: record.warrantyEnd ? new Date(record.warrantyEnd) : undefined,
      notes: record.notes || undefined,
      assignedToId: undefined,
    };

    if (record.assignedTo) {
      const person = await prisma.person.upsert({
        where: {
          workspaceId_name: {
            workspaceId,
            name: record.assignedTo,
          },
        },
        create: {
          workspaceId,
          name: record.assignedTo,
        },
        update: {},
      });
      payload.assignedToId = person.id;
    }

    const existing = await prisma.asset.findFirst({
      where: { workspaceId, assetTag: payload.assetTag },
    });

    if (existing) {
      await updateAsset(workspaceId, userId, existing.id, payload);
      updated.push(payload.assetTag);
    } else {
      await createAsset(workspaceId, userId, payload);
      created.push(payload.assetTag);
    }
  }

  return { created, updated, count: records.length };
}

export async function exportAssetsToCsv(workspaceId: string, filters: AssetFilterInput) {
  const assets = await listAssets(workspaceId, filters);
  const parser = new CsvParser({
    fields: [
      "assetTag",
      "serialNumber",
      "category",
      "brand",
      "model",
      "status",
      "location",
      "vendor",
      "purchaseDate",
      "warrantyEnd",
      "notes",
      "assignedTo.name",
    ],
  });

  const data = assets.map((asset) => ({
    ...asset,
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().split("T")[0] : "",
    warrantyEnd: asset.warrantyEnd ? asset.warrantyEnd.toISOString().split("T")[0] : "",
    "assignedTo.name": asset.assignedTo?.name ?? "",
  }));

  return parser.parse(data);
}
