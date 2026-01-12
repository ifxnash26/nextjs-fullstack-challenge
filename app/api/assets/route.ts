import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { listAssets, createAsset } from "@/lib/assets";
import { assetInputSchema } from "@/lib/validators";
import { getWorkspaceMembership } from "@/lib/workspaces";
import { AssetStatus } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statusParam = searchParams.getAll("status");
  const normalizeStatus = (value: string) => {
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
    return normalized === "IN_USED" || normalized === "IN_USE" ? "ASSIGNED" : normalized;
  };
  const status = statusParam
    .flatMap((s) => s.split(","))
    .map((s) => normalizeStatus(s))
    .filter((s) => Object.values(AssetStatus).includes(s as AssetStatus)) as AssetStatus[];
  const warrantyExpiringInDays = searchParams.get("warrantyExpiringInDays");
  const purchasedWithinDays = searchParams.get("purchasedWithinDays");
  const limit = searchParams.get("limit");

  const assets = await listAssets(workspaceId, {
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    brand: searchParams.get("brand") ?? undefined,
    model: searchParams.get("model") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    assignedTo: searchParams.get("assignedTo") ?? undefined,
    status: status.length ? status : undefined,
    sort: (searchParams.get("sort") as any) ?? undefined,
    direction: (searchParams.get("direction") as any) ?? undefined,
    warrantyExpiringInDays: warrantyExpiringInDays ? Number(warrantyExpiringInDays) : undefined,
    purchasedWithinDays: purchasedWithinDays ? Number(purchasedWithinDays) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = assetInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!body.workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, body.workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const asset = await createAsset(body.workspaceId, session.user.id, parsed.data);
    return NextResponse.json(asset);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
