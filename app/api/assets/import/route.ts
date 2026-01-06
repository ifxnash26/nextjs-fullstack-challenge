import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importAssetsFromCsv } from "@/lib/assets";
import { getWorkspaceMembership } from "@/lib/workspaces";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const workspaceId = String(formData.get("workspaceId") || "");

  if (!workspaceId || !file || !(file instanceof File)) {
    return NextResponse.json({ error: "workspaceId and file are required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const csvText = await file.text();
  try {
    const result = await importAssetsFromCsv(workspaceId, session.user.id, csvText);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
