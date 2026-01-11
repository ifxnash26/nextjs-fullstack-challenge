import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { exportAssetsToCsv } from "@/lib/assets";
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
  const status = statusParam
    .flatMap((s) => s.split(","))
    .map((s) => s.trim().toUpperCase())
    .filter((s) => Object.values(AssetStatus).includes(s as AssetStatus)) as AssetStatus[];
  const warrantyExpiringInDays = searchParams.get("warrantyExpiringInDays");
  const purchasedWithinDays = searchParams.get("purchasedWithinDays");
  const limit = searchParams.get("limit");
  const sortParam = searchParams.get("sort");
  const directionParam = searchParams.get("direction");
  const allowedSort = ["updatedAt", "createdAt", "purchaseDate", "warrantyEnd", "assetTag"] as const;
  const allowedDirection = ["asc", "desc"] as const;
  const sort = allowedSort.includes(sortParam as (typeof allowedSort)[number]) ? (sortParam as (typeof allowedSort)[number]) : undefined;
  const direction = allowedDirection.includes(directionParam as (typeof allowedDirection)[number])
    ? (directionParam as (typeof allowedDirection)[number])
    : undefined;

  const csv = await exportAssetsToCsv(workspaceId, {
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    brand: searchParams.get("brand") ?? undefined,
    model: searchParams.get("model") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    assignedTo: searchParams.get("assignedTo") ?? undefined,
    status: status.length ? status : undefined,
    warrantyExpiringInDays: warrantyExpiringInDays ? Number(warrantyExpiringInDays) : undefined,
    purchasedWithinDays: purchasedWithinDays ? Number(purchasedWithinDays) : undefined,
    limit: limit ? Number(limit) : undefined,
    sort: sort ?? undefined,
    direction: direction ?? undefined,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=\"assets.csv\"",
    },
  });
}
