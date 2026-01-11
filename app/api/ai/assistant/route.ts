import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { AssetStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { deriveAssistantAction, filterSpecToAssetFilterInput } from "@/lib/ai";
import { getAssistantIntentFromModel } from "@/lib/ai-client";
import { bulkCreateAssets, bulkDeleteAssets, bulkUpdateAssets, findExistingAssetTags, previewAssetsForUpdate } from "@/lib/assets";
import { filterSpecSchema, type AssetFilterInput, type AssetInput } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

const updateSchema = z
  .object({
    status: z.nativeEnum(AssetStatus).optional(),
    category: z.string().min(1).optional(),
    assignedTo: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.status || data.category || data.assignedTo || data.location), { message: "update is required" });

const createSchema = z.object({
  count: z.number().int().positive(),
  tagPrefix: z.string().min(1),
  tagStart: z.number().int().nonnegative(),
  tagWidth: z.number().int().positive(),
  category: z.string().optional(),
  status: z.nativeEnum(AssetStatus).optional(),
});

const maxCreateCount = 200;

function buildAssetTags(prefix: string, start: number, width: number, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}${String(start + index).padStart(width, "0")}`);
}

function hasFilterCriteria(filters: AssetFilterInput) {
  return Boolean(
    filters.q ||
      (filters.assetTags && filters.assetTags.length) ||
      filters.category ||
      filters.location ||
      filters.assignedTo ||
      filters.purchasedWithinDays ||
      filters.warrantyExpiringInDays ||
      (filters.status && filters.status.length),
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceId = String(body?.workspaceId || "");
  const apply = Boolean(body?.apply);

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  if (apply) {
    if (body?.delete) {
      const specResult = filterSpecSchema.safeParse(body?.spec);
      if (!specResult.success) {
        return NextResponse.json({ error: "spec is required" }, { status: 400 });
      }

      const filters = filterSpecToAssetFilterInput(specResult.data);
      if (!hasFilterCriteria(filters)) {
        return NextResponse.json({ error: "Please describe which assets to delete." }, { status: 400 });
      }

      try {
        const result = await bulkDeleteAssets(workspaceId, session.user.id, filters);
        return NextResponse.json({ intent: "delete", deletedCount: result.count });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not delete those assets.";
        const status = message.includes("admin") ? 403 : 400;
        return NextResponse.json({ error: message }, { status });
      }
    }

    if (body?.create) {
      const createResult = createSchema.safeParse(body.create);
      if (!createResult.success) {
        return NextResponse.json({ error: "create is required" }, { status: 400 });
      }

      const create = createResult.data;
      if (create.count > maxCreateCount) {
        return NextResponse.json({ error: `Please limit to ${maxCreateCount} assets at a time.` }, { status: 400 });
      }

      const tags = buildAssetTags(create.tagPrefix, create.tagStart, create.tagWidth, create.count);
      const assets = tags.map((tag) => ({
        assetTag: tag,
        category: create.category || undefined,
        status: create.status ?? AssetStatus.IN_STOCK,
        serialNumber: undefined,
        brand: undefined,
        model: undefined,
        location: undefined,
        purchaseDate: undefined,
        warrantyEnd: undefined,
        notes: undefined,
        assignedToId: undefined,
      }));

      const result = await bulkCreateAssets(workspaceId, session.user.id, assets);
      return NextResponse.json({ intent: "create", createdCount: result.count });
    }

    const specResult = filterSpecSchema.safeParse(body?.spec);
    const updateResult = updateSchema.safeParse(body?.update);

    if (!specResult.success || !updateResult.success) {
      return NextResponse.json({ error: "spec and update are required" }, { status: 400 });
    }

    const filters = filterSpecToAssetFilterInput(specResult.data);
    if (!hasFilterCriteria(filters)) {
      return NextResponse.json({ error: "Please describe which assets to update." }, { status: 400 });
    }

    const updates: Partial<AssetInput> & { assignedTo?: string } = { ...updateResult.data };
    if (updates.assignedTo) {
      const person = await prisma.person.findFirst({
        where: { workspaceId, name: { equals: updates.assignedTo, mode: "insensitive" } },
      });

      if (!person) {
        return NextResponse.json({ error: `User "${updates.assignedTo}" not found. Add them first, then try again.` }, { status: 400 });
      }

      updates.assignedToId = person.id;
      delete (updates as { assignedTo?: string }).assignedTo;
    }

    const result = await bulkUpdateAssets(workspaceId, session.user.id, filters, updates);
    return NextResponse.json({ intent: "update", updatedCount: result.count });
  }

  const text = typeof body?.text === "string" ? body.text : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const modelIntent = await getAssistantIntentFromModel(text).catch(() => null);
  const intent = modelIntent ?? deriveAssistantAction(text);
  if (intent.intent === "filter") {
    return NextResponse.json({ intent: "filter", spec: intent.spec });
  }

  if (intent.intent === "update") {
    const filters = filterSpecToAssetFilterInput(intent.spec);
    if (!hasFilterCriteria(filters)) {
      return NextResponse.json({ error: "Please describe which assets to update." }, { status: 400 });
    }

    const preview = await previewAssetsForUpdate(workspaceId, filters);
    if (!preview.count) {
      return NextResponse.json({ error: "No assets match that request." }, { status: 400 });
    }

    return NextResponse.json({
      intent: "update",
      spec: intent.spec,
      update: intent.update,
      count: preview.count,
      sample: preview.sample,
    });
  }

  if (intent.intent === "delete") {
    const filters = filterSpecToAssetFilterInput(intent.spec);
    if (!hasFilterCriteria(filters)) {
      return NextResponse.json({ error: "Please describe which assets to delete." }, { status: 400 });
    }

    const preview = await previewAssetsForUpdate(workspaceId, filters);
    if (!preview.count) {
      return NextResponse.json({ error: "No assets match that request." }, { status: 400 });
    }

    return NextResponse.json({
      intent: "delete",
      spec: intent.spec,
      count: preview.count,
      sample: preview.sample,
    });
  }

  if (intent.intent === "create") {
    if (intent.create.count > maxCreateCount) {
      return NextResponse.json({ error: `Please limit to ${maxCreateCount} assets at a time.` }, { status: 400 });
    }

    const tags = buildAssetTags(intent.create.tagPrefix, intent.create.tagStart, intent.create.tagWidth, intent.create.count);
    const existing = await findExistingAssetTags(workspaceId, tags);
    if (existing.length) {
      return NextResponse.json(
        { error: `These asset tags already exist: ${existing.slice(0, 8).join(", ")}.` },
        { status: 400 },
      );
    }

    return NextResponse.json({
      intent: "create",
      create: intent.create,
      count: tags.length,
      range: { start: tags[0], end: tags[tags.length - 1] },
      sample: tags.slice(0, 5),
    });
  }

  return NextResponse.json({ error: intent.message }, { status: 400 });
}
