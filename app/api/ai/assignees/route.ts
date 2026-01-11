import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMembership } from "@/lib/workspaces";
import { effectiveRole, hasRequiredRole } from "@/lib/rbac";
import { Role } from "@prisma/client";

type Payload = {
  workspaceId?: string;
  message?: string;
};

function parseAssignee(message: string) {
  const emailMatch = message.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const email = emailMatch ? emailMatch[0] : undefined;
  const cleaned = message.replace(email ?? "", "").replace(/\b(add|create|new|set|assignee|user|person|with|as)\b/gi, " ");
  const parts = cleaned
    .split(/[,\|]/)
    .map((p) => p.trim())
    .filter(Boolean);

  let name: string | undefined;
  let title: string | undefined;
  if (parts.length === 1) {
    name = parts[0];
  } else if (parts.length >= 2) {
    name = parts[0];
    title = parts.slice(1).join(" ");
  }

  if (!name && email) {
    name = email.split("@")[0];
  }

  return { name: name?.trim(), email: email?.toLowerCase(), title: title?.trim() };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Payload;
  const workspaceId = body.workspaceId;
  const message = body.message ?? "";
  if (!workspaceId || !message.trim()) {
    return NextResponse.json({ error: "workspaceId and message are required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const role = effectiveRole(session.user.role as Role, membership.role);
  if (!hasRequiredRole(role, Role.IT_STAFF)) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  const { name, email, title } = parseAssignee(message);
  if (!name) {
    return NextResponse.json({ error: "Could not find a name to add." }, { status: 400 });
  }

  const person = await prisma.person.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: { email: email ?? undefined, title: title ?? undefined },
    create: { workspaceId, name, email, title },
    select: { id: true, name: true, email: true, title: true },
  });

  return NextResponse.json({
    success: true,
    person,
    message: "Assignee added/updated.",
  });
}
