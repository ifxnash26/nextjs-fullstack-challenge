import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { deleteAsset, getAsset, updateAsset } from "@/lib/assets";
import { prisma } from "@/lib/prisma";
import { assetInputSchema } from "@/lib/validators";
import { getWorkspaceMembership } from "@/lib/workspaces";

async function getWorkspaceIdForAsset(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { workspaceId: true } });
  return asset?.workspaceId;
}

export async function GET(_request: Request, { params }: { params: { assetId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForAsset(params.assetId);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const asset = await getAsset(workspaceId, params.assetId);
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(asset);
}

export async function PUT(request: Request, { params }: { params: { assetId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForAsset(params.assetId);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = assetInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const asset = await updateAsset(workspaceId, session.user.id, params.assetId, parsed.data);
    return NextResponse.json(asset);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { assetId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForAsset(params.assetId);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const asset = await deleteAsset(workspaceId, session.user.id, params.assetId);
    return NextResponse.json(asset);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
