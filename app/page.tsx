import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkspaceWithMembership } from "@/lib/workspaces";
import { workspaceNameSchema } from "@/lib/validators";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

async function createWorkspaceAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const parsed = workspaceNameSchema.safeParse({ name: String(formData.get("name") || "") });
  if (!parsed.success) {
    throw new Error("Workspace name must be at least 2 characters.");
  }

  const workspace = await createWorkspaceWithMembership(session.user.id, parsed.data.name);
  revalidatePath("/");
  redirect(`/w/${workspace.id}/assets`);
}

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { createdAt: "asc" },
  });

  if (workspaces.length) {
    redirect(`/w/${workspaces[0].id}/assets`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">AssetSpace AI</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-foreground">Create your first workspace</h1>
        <p className="mt-2 text-muted-foreground">
          Spin up a workspace to track assets and invite your IT team. You can manage members from the Admin panel once created.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Workspace details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createWorkspaceAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="name">
                Workspace name
              </label>
              <input
                id="name"
                name="name"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                placeholder="IT Ops"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit">Create workspace</Button>
              <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
                Back to login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
