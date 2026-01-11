import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planFromMessage } from "@/server/ai/actions/planFromMessage";
import { previewPlan } from "@/server/ai/actions/previewPlan";
import { getWorkspaceMembership } from "@/lib/workspaces";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message : "";
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const currentFilter = body?.currentFilter;

  if (!message.trim() || !workspaceId) {
    return NextResponse.json({ error: "message and workspaceId are required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const plan = await planFromMessage({ message, workspaceId, userId: session.user.id, currentFilter });

  if (plan.actions.length === 0 && plan.clarifyingQuestion) {
    return NextResponse.json({ clarifyingQuestion: plan.clarifyingQuestion });
  }

  const preview = await previewPlan(plan, workspaceId);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const record = await prisma.aiActionPlan.create({
    data: {
      workspaceId,
      userId: session.user.id,
      planJson: plan,
      previewJson: preview,
      requiresConfirmation: preview.requiresConfirmation,
      confirmationText: preview.confirmationText,
      expiresAt,
    },
  });

  return NextResponse.json({
    planId: record.id,
    preview,
    requiresConfirmation: preview.requiresConfirmation,
    confirmationText: preview.confirmationText,
  });
}
