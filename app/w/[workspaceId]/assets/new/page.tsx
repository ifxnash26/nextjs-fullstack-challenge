import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditAssets, effectiveRole } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateAssetForm } from "@/components/create-asset-form";

export default async function NewAssetPage({ params }: { params: { workspaceId: string } }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  });

  if (!membership) {
    redirect("/login");
  }

  const role = effectiveRole(session.user.role, membership.role);
  if (!canEditAssets(role)) {
    redirect(`/w/${params.workspaceId}/assets`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Assets</p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground">Create asset</h1>
          <p className="text-muted-foreground">Add a new asset to this workspace.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/assets`}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
        >
          Back to table
        </Link>
      </div>

      <Card>
        <CardContent>
          <CreateAssetForm workspaceId={params.workspaceId} />
        </CardContent>
      </Card>
    </div>
  );
}
