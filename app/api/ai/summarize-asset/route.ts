import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { summarizeAsset, getAssetSummaryContext } from "@/server/ai/summarizeAsset";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const assetId = typeof body?.assetId === "string" ? body.assetId : "";

  if (!workspaceId || !assetId) {
    return NextResponse.json({ error: "workspaceId and assetId are required" }, { status: 400 });
  }

  try {
    const context = await getAssetSummaryContext(workspaceId, assetId, session.user.id);
    const result = await summarizeAsset(context);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to summarize";
    if (message.toLowerCase().includes("access")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to summarize" }, { status: 500 });
  }
}
