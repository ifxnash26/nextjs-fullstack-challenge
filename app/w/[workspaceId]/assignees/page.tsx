import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditAssets, effectiveRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function createPersonAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = String(formData.get("workspaceId") || "");
  const name = String(formData.get("name") || "").trim();
  const email = formData.get("email") ? String(formData.get("email")) : null;
  const title = formData.get("title") ? String(formData.get("title")) : null;

  if (!workspaceId || !name) return;

  await prisma.person.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: { email, title },
    create: { workspaceId, name, email, title },
  });

  revalidatePath(`/w/${workspaceId}/assignees`);
}

async function bulkCreatePeopleAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = String(formData.get("workspaceId") || "");
  const raw = String(formData.get("people") || "").trim();
  if (!workspaceId || !raw) return;

  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const row of rows) {
    const parts = row.split(",").map((part) => part.trim());
    const name = parts[0];
    if (!name) continue;
    const email = parts[1] || null;
    const title = parts[2] || null;

    await prisma.person.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: { ...(email ? { email } : {}), ...(title ? { title } : {}) },
      create: { workspaceId, name, email, title },
    });
  }

  revalidatePath(`/w/${workspaceId}/assignees`);
}

async function updatePersonAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");
  const id = String(formData.get("id") || "");
  const workspaceId = String(formData.get("workspaceId") || "");
  if (!id || !workspaceId) return;

  const name = String(formData.get("name") || "").trim();
  const email = formData.get("email") ? String(formData.get("email")) : null;
  const title = formData.get("title") ? String(formData.get("title")) : null;

  await prisma.person.update({
    where: { id },
    data: { name: name || undefined, email, title },
  });

  revalidatePath(`/w/${workspaceId}/assignees`);
}

async function deletePersonAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");
  const id = String(formData.get("id") || "");
  const workspaceId = String(formData.get("workspaceId") || "");
  if (!id || !workspaceId) return;

  await prisma.asset.updateMany({
    where: { workspaceId, assignedToId: id },
    data: { assignedToId: null },
  });

  await prisma.person.delete({ where: { id } });
  revalidatePath(`/w/${workspaceId}/assignees`);
}

export default async function AssigneesPage({ params }: { params: { workspaceId: string } }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  });
  if (!membership) redirect("/login");

  const role = effectiveRole(session.user.role, membership.role);
  if (!canEditAssets(role)) redirect(`/w/${params.workspaceId}/assets`);

  const people = await prisma.person.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assets: true } },
    },
  });

  return (
    <div className="space-y-6 px-4 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Workspace</p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground">Manage assignees</h1>
          <p className="text-muted-foreground">Add, edit, or remove people used as asset assignees.</p>
        </div>
        <Button
          asChild
          variant="secondary"
          className="rounded-full px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
        >
          <a href={`/w/${params.workspaceId}/assets`}>Back to assets</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add assignee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={createPersonAction} className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
            <input type="hidden" name="workspaceId" value={params.workspaceId} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="name">
                Name
              </label>
              <Input id="name" name="name" placeholder="Ada Lovelace" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" placeholder="ada@example.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="title">
                Title
              </label>
              <Input id="title" name="title" placeholder="IT Lead" />
            </div>
            <Button
              type="submit"
              variant="secondary"
              className="h-10 rounded-full px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
            >
              Add User
            </Button>
          </form>

          <form action={bulkCreatePeopleAction} className="space-y-3">
            <input type="hidden" name="workspaceId" value={params.workspaceId} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="people">
                Bulk add assignees
              </label>
              <Textarea
                id="people"
                name="people"
                rows={4}
                placeholder="Name, email, title&#10;Ada Lovelace, ada@example.com, IT Lead&#10;Grace Hopper, grace@example.com, Engineer"
              />
              <p className="text-xs text-muted-foreground">One user per line. Format: name, optional email, optional title. Existing names are updated.</p>
            </div>
            <Button
              type="submit"
              variant="secondary"
              className="h-10 rounded-full px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
            >
              Add Users
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignee directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Name</span>
            <span>Email</span>
            <span>Title</span>
            <span>Assets</span>
            <span className="text-right">Actions</span>
          </div>
          {people.map((person) => (
            <div key={person.id} className="grid grid-cols-5 items-center rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <form action={updatePersonAction} className="contents">
                <input type="hidden" name="id" value={person.id} />
                <input type="hidden" name="workspaceId" value={params.workspaceId} />
                <Input name="name" defaultValue={person.name} className="h-9" />
                <Input name="email" defaultValue={person.email ?? ""} className="h-9" />
                <Input name="title" defaultValue={person.title ?? ""} className="h-9" />
                <span className="text-muted-foreground">{person._count.assets}</span>
                <div className="flex items-center justify-end gap-2">
                  <Button type="submit" variant="ghost" size="sm" className="rounded-full px-3 text-xs font-semibold">
                    Save
                  </Button>
                  <form action={deletePersonAction}>
                    <input type="hidden" name="id" value={person.id} />
                    <input type="hidden" name="workspaceId" value={params.workspaceId} />
                    <Button type="submit" variant="ghost" size="sm" className="rounded-full px-3 text-xs font-semibold text-red-600">
                      Remove
                    </Button>
                  </form>
                </div>
              </form>
            </div>
          ))}
          {people.length === 0 ? <p className="text-sm text-muted-foreground">No assignees yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
