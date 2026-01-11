import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { buildFilterSpec } from "@/server/ai/buildFilterSpec";
import { normalizeFilterSpec } from "@/server/ai/filterSpec";
import { getWorkspaceMembership } from "@/lib/workspaces";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message : typeof body?.text === "string" ? body.text : "";
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const rawCurrentFilter = body?.currentFilter && typeof body.currentFilter === "object" ? body.currentFilter : undefined;
  const currentFilter =
    rawCurrentFilter && Object.keys(rawCurrentFilter).length ? normalizeFilterSpec(rawCurrentFilter) : undefined;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const result = await buildFilterSpec({ message, workspaceId, currentFilter }).catch(() => null);
  if (!result) {
    return NextResponse.json({ error: "Could not process that request right now." }, { status: 500 });
  }

  return NextResponse.json(result);
}
