import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getAsset } from "@/lib/assets";
import { getWorkspaceMembership } from "@/lib/workspaces";
import { summarizeAssetContent } from "@/lib/ai";

export async function GET(_request: Request, { params }: { params: { assetId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assetRecord = await prisma.asset.findUnique({ where: { id: params.assetId }, select: { workspaceId: true } });
  if (!assetRecord) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await getWorkspaceMembership(session.user.id, assetRecord.workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const asset = await getAsset(assetRecord.workspaceId, params.assetId);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const summary = summarizeAssetContent(
    asset.notes,
    asset.activities.map((activity) => ({
      action: activity.action,
      createdAt: activity.createdAt,
    })),
  );

  return NextResponse.json({ summary });
}
