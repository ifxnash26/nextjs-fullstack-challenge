import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";
import { userCreateSchema } from "@/lib/validators";
import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function createUserAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    redirect("/login");
  }

  const body = {
    name: formData.get("name") ? String(formData.get("name")) : undefined,
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    role: (formData.get("role") as Role) || Role.VIEWER,
    workspaceId: formData.get("workspaceId") ? String(formData.get("workspaceId")) : null,
  };

  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return;
  }

  const hashedPassword = await hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      hashedPassword,
      role: parsed.data.role,
    },
  });

  if (body.workspaceId) {
    await prisma.workspaceMember.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: body.workspaceId } },
      update: { role: parsed.data.role },
      create: { userId: user.id, workspaceId: body.workspaceId, role: parsed.data.role },
    });
  }

  revalidatePath("/admin/users");
}

async function updateUserRoleAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/login");
  }

  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || Role.VIEWER) as Role;
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  const session = await getCurrentSession();
  if (!session?.user || !canManageUsers(session.user.role)) {
    redirect("/login");
  }

  const [users, workspaces] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { memberships: { include: { workspace: true } } },
    }),
    prisma.workspace.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Admin</p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground">Users & roles</h1>
          <p className="text-muted-foreground">Manage global roles and workspace membership.</p>
        </div>
        <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href="/">
          Back to home
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create user</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createUserAction} className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="name">
                Name
              </label>
              <Input id="name" name="name" placeholder="Alex Rivera" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" placeholder="alex@example.com" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <Input id="password" name="password" type="password" placeholder="••••••••" minLength={6} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="role">
                Role
              </label>
              <Select id="role" name="role" defaultValue={Role.VIEWER}>
                {Object.values(Role).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="workspaceId">
                Add to workspace
              </label>
              <Select id="workspaceId" name="workspaceId" defaultValue="">
                <option value="">None</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="md:col-span-1">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>User</span>
            <span>Email</span>
            <span>Role</span>
            <span>Workspaces</span>
            <span className="text-right">Actions</span>
          </div>
          {users.map((user) => (
            <div key={user.id} className="grid grid-cols-5 items-center rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="font-semibold text-foreground">{user.name ?? "—"}</div>
              <div className="truncate text-muted-foreground">{user.email}</div>
              <div className="text-muted-foreground">{user.role}</div>
              <div className="text-muted-foreground">
                {user.memberships.length
                  ? user.memberships.map((m) => m.workspace.name).join(", ")
                  : "No workspaces"}
              </div>
              <div className="text-right">
                <form action={updateUserRoleAction} className="flex items-center justify-end gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <Select name="role" defaultValue={user.role}>
                    {Object.values(Role).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline" className="h-9 px-3">
                    Update
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
