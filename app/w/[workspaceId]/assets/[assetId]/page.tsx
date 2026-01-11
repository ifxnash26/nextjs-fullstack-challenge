import { AssetEditor } from "@/components/asset-editor";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { AssetSummaryButton } from "@/components/asset-summary-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentSession } from "@/lib/auth";
import { getAsset } from "@/lib/assets";
import { prisma } from "@/lib/prisma";
import { canEditAssets, effectiveRole } from "@/lib/rbac";
import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type AssetStatusValue } from "@/lib/constants";
import { AiWorkspace } from "@/components/ai-workspace";

function formatAssetTag(tag: string) {
  return tag.toUpperCase();
}

function formatCategoryLabel(category?: string | null) {
  if (!category) return category;
  return category.charAt(0).toUpperCase() + category.slice(1);
}

async function createPersonAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = String(formData.get("workspaceId") || "");
  const assetId = String(formData.get("assetId") || "");
  const name = String(formData.get("name") || "").trim();
  const email = formData.get("email") ? String(formData.get("email")) : null;
  const title = formData.get("title") ? String(formData.get("title")) : null;

  if (!workspaceId || !assetId || !name) return;

  await prisma.person.create({
    data: {
      name,
      email,
      title,
      workspaceId,
    },
  });

  revalidatePath(`/w/${workspaceId}/assets/${assetId}`);
}

async function bulkCreatePeopleAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = String(formData.get("workspaceId") || "");
  const assetId = String(formData.get("assetId") || "");
  const raw = String(formData.get("people") || "").trim();

  if (!workspaceId || !assetId || !raw) return;

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
      where: {
        workspaceId_name: {
          workspaceId,
          name,
        },
      },
      create: { workspaceId, name, email, title },
      update: {
        ...(email ? { email } : {}),
        ...(title ? { title } : {}),
      },
    });
  }

  revalidatePath(`/w/${workspaceId}/assets/${assetId}`);
}

export default async function AssetDetailPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  });
  if (!membership) redirect("/login");

  const role = effectiveRole(session.user.role, membership.role);
  const asset = await getAsset(params.workspaceId, params.assetId);
  if (!asset) redirect(`/w/${params.workspaceId}/assets`);

  const people = await prisma.person.findMany({ where: { workspaceId: params.workspaceId }, orderBy: { name: "asc" } });
  const canEdit = canEditAssets(role);
  const clientAsset = {
    id: asset.id,
    status: asset.status as AssetStatusValue,
    assignedToId: asset.assignedToId ?? null,
    serialNumber: asset.serialNumber ?? null,
    imeiNumber: (asset as any).imeiNumber ?? null,
    deviceSpec: (asset as any).deviceSpec ?? null,
    accessories: (asset as any).accessories ?? null,
    brand: asset.brand ?? null,
    category: asset.category ?? null,
    location: asset.location ?? null,
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().split("T")[0] : null,
    warrantyEnd: asset.warrantyEnd ? asset.warrantyEnd.toISOString().split("T")[0] : null,
    notes: asset.notes ?? null,
    assignedTo: asset.assignedTo ? { id: asset.assignedTo.id, name: asset.assignedTo.name } : null,
  };

  const clientPeople = people.map((person) => ({ id: person.id, name: person.name }));
  const secondary = asset.model ?? asset.category;
  const secondaryLabel = asset.model ? secondary : formatCategoryLabel(secondary);
  const showPrintHandoff = (asset.category ?? "").toLowerCase() === "ipad";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Asset</p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground">{formatAssetTag(asset.assetTag)}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <AssetStatusBadge status={asset.status} />
            <span>{[asset.brand, secondaryLabel].filter(Boolean).join(" - ")}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showPrintHandoff ? (
            <Link
              href={`/w/${params.workspaceId}/assets/${params.assetId}/handoff`}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
            >
              Print handoff
            </Link>
          ) : null}
          <Link
            href={`/w/${params.workspaceId}/assets`}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
          >
            Back to table
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Asset details</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetEditor asset={clientAsset} people={clientPeople} canEdit={canEdit} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {asset.notes ? (
              <div className="prose prose-sm max-w-none text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{asset.notes}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            )}
            <AssetSummaryButton assetId={asset.id} workspaceId={params.workspaceId} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {asset.activities.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded.</p> : null}
          {asset.activities.map((activity) => (
            <div key={activity.id} className="flex items-start justify-between rounded-md border border-border bg-card px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{activity.action}</p>
                <p className="text-xs text-muted-foreground">
                  {activity.user?.email ?? "system"} - {format(activity.createdAt, "PPpp")}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{activity.workspaceId.slice(0, 6)}...</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <AiWorkspace workspaceId={params.workspaceId} assetId={params.assetId} />
    </div>
  );
}







