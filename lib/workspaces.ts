import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { effectiveRole, hasRequiredRole } from "./rbac";

export async function getWorkspaceMembership(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });
}

export async function requireWorkspaceAccess(userId: string, workspaceId: string, minRole: Role = Role.VIEWER) {
  const [workspace, membership] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    getWorkspaceMembership(userId, workspaceId),
  ]);

  if (!workspace || !membership) {
    throw new Error("Workspace access denied");
  }

  const role = effectiveRole((await prisma.user.findUnique({ where: { id: userId } }))!.role, membership.role);
  if (!hasRequiredRole(role, minRole)) {
    throw new Error("Insufficient role");
  }

  return { workspace, membership, role };
}

export async function listUserWorkspaces(userId: string) {
  return prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createWorkspaceWithMembership(userId: string, name: string) {
  return prisma.workspace.create({
    data: {
      name,
      owner: { connect: { id: userId } },
      members: {
        create: {
          userId,
          role: Role.ADMIN,
        },
      },
    },
  });
}
