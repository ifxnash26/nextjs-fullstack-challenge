import React from "react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effectiveRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { type RoleValue } from "@/lib/constants";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: params.workspaceId },
    include: {
      members: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
  });

  if (!workspace || workspace.members.length === 0) {
    redirect("/login");
  }

  const membershipRole = workspace.members[0].role;
  const role = effectiveRole(session.user.role, membershipRole);

  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader
        workspace={{ id: workspace.id, name: workspace.name }}
        membershipRole={membershipRole as RoleValue}
        userRole={role as RoleValue}
        userEmail={session.user.email}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
