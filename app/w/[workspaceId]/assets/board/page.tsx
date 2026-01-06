import { AssetStatusBadge } from "@/components/asset-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { prisma } from "@/lib/prisma";
import { effectiveRole } from "@/lib/rbac";
import { AssetStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AssetBoardPage({ params }: { params: { workspaceId: string } }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  });
  if (!membership) redirect("/login");

  const role = effectiveRole(session.user.role, membership.role);
  const assets = await listAssets(params.workspaceId, {});

  const grouped = Object.values(AssetStatus).map((status) => ({
    status,
    items: assets.filter((asset) => asset.status === status),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Assets</p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground">Board by status</h1>
          <p className="text-muted-foreground">Track assignments and lifecycle at a glance.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/w/${params.workspaceId}/assets`}>Back to table</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {grouped.map((column) => (
          <Card key={column.status} className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <AssetStatusBadge status={column.status} /> {column.status.replace("_", " ")}
              </CardTitle>
              <span className="text-sm text-muted-foreground">{column.items.length}</span>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {column.items.map((asset) => (
                <Link
                  key={asset.id}
                  href={`/w/${params.workspaceId}/assets/${asset.id}`}
                  className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm transition hover:border-primary"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">{asset.assetTag}</p>
                    <span className="text-xs text-muted-foreground">{asset.category || asset.model || asset.brand}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {asset.assignedTo?.name ? `Assigned to ${asset.assignedTo.name}` : "Unassigned"}
                  </p>
                  {asset.location ? <p className="text-xs text-muted-foreground">Location: {asset.location}</p> : null}
                </Link>
              ))}
              {column.items.length === 0 ? <p className="text-sm text-muted-foreground">No assets here yet.</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
