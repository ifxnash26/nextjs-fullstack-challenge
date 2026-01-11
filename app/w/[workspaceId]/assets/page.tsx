import { CreateAssetForm } from "@/components/create-asset-form";
import { ImportExportBar } from "@/components/import-export-bar";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { AssetListToggle } from "@/components/asset-list-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiWorkspace } from "@/components/ai-workspace";
import { getCurrentSession } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { prisma } from "@/lib/prisma";
import { canEditAssets, effectiveRole } from "@/lib/rbac";
import { AssetStatus } from "@prisma/client";
import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

function parseStatuses(searchParams: Record<string, string | string[] | undefined>) {
  const raw = searchParams.status;
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : raw.split(",");
  return values
    .map((value) => value.toString().toUpperCase())
    .filter((value) => Object.values(AssetStatus).includes(value as AssetStatus)) as AssetStatus[];
}

function parseAssetTags(searchParams: Record<string, string | string[] | undefined>) {
  const raw = searchParams.assetTags;
  if (!raw) return undefined;
  const values = Array.isArray(raw) ? raw.join(",") : raw;
  const tags = values
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
}

function formatAssetTag(tag: string) {
  return tag.toUpperCase();
}

function formatCategoryLabel(category?: string | null) {
  if (!category) return category;
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default async function AssetsPage({
  params,
  searchParams,
}: {
  params: { workspaceId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const asNumber = (value: string | string[] | undefined) => {
    if (typeof value !== "string") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

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
  const statusFilters = parseStatuses(searchParams);
  const assetTags = parseAssetTags(searchParams);
  const warrantyExpiringInDays = asNumber(searchParams.warrantyExpiringInDays);
  const purchasedWithinDays = asNumber(searchParams.purchasedWithinDays);
  const limit = asNumber(searchParams.limit);
  const allowedSort = ["updatedAt", "createdAt", "assetTag", "purchaseDate", "warrantyEnd"] as const;
  const allowedDirection = ["asc", "desc"] as const;
  const sort =
    typeof searchParams.sort === "string" && allowedSort.includes(searchParams.sort as (typeof allowedSort)[number])
      ? (searchParams.sort as (typeof allowedSort)[number])
      : undefined;
  const direction =
    typeof searchParams.direction === "string" &&
    allowedDirection.includes(searchParams.direction as (typeof allowedDirection)[number])
      ? (searchParams.direction as (typeof allowedDirection)[number])
      : undefined;

  const filters = {
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    assetTags,
    category: typeof searchParams.category === "string" ? searchParams.category : undefined,
    location: typeof searchParams.location === "string" ? searchParams.location : undefined,
    sort,
    direction,
    status: statusFilters.length ? statusFilters : undefined,
    warrantyExpiringInDays,
    purchasedWithinDays,
    limit,
  };

  const assets = await listAssets(params.workspaceId, filters);

  const exportUrl = (() => {
    const paramsList = new URLSearchParams();
    paramsList.set("workspaceId", params.workspaceId);
    if (filters.q) paramsList.set("q", filters.q);
    if (filters.category) paramsList.set("category", filters.category);
    if (filters.location) paramsList.set("location", filters.location);
    if (filters.sort) paramsList.set("sort", filters.sort);
    if (filters.direction) paramsList.set("direction", filters.direction);
    if (filters.assetTags?.length) {
      paramsList.set("assetTags", filters.assetTags.join(","));
    }
    if (filters.warrantyExpiringInDays) {
      paramsList.set("warrantyExpiringInDays", filters.warrantyExpiringInDays.toString());
    }
    if (filters.purchasedWithinDays) {
      paramsList.set("purchasedWithinDays", filters.purchasedWithinDays.toString());
    }
    if (filters.limit) {
      paramsList.set("limit", filters.limit.toString());
    }
    filters.status?.forEach((status) => paramsList.append("status", status));
    return `/api/assets/export?${paramsList.toString()}`;
  })();

  const statusCounts = assets.reduce<Record<AssetStatus, number>>((acc, asset) => {
    acc[asset.status] = (acc[asset.status] || 0) + 1;
    return acc;
  }, {} as Record<AssetStatus, number>);
  const statusGradients: Record<AssetStatus, string> = {
    [AssetStatus.IN_STOCK]: "from-emerald-500/10",
    [AssetStatus.ASSIGNED]: "from-sky-500/10",
    [AssetStatus.REPAIR]: "from-amber-500/10",
    [AssetStatus.RETIRED]: "from-slate-500/10",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Assets</p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground">Inventory table</h1>
          <p className="text-muted-foreground">Filter, sort, and export assets in this workspace.</p>
        </div>
        <div className="flex items-center gap-3">
          {canEditAssets(role) ? (
            <Link
              href={`/w/${params.workspaceId}/assets/new`}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-primary underline-offset-4 hover:bg-muted"
            >
              Add asset
            </Link>
          ) : null}
          {canEditAssets(role) ? (
            <Link
              href={`/w/${params.workspaceId}/assignees`}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
            >
              Manage assignees
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {Object.values(AssetStatus).map((status) => (
          <div
            key={status}
            className={`rounded-lg border border-border/70 bg-card/80 bg-gradient-to-br ${statusGradients[status]} to-transparent px-3 py-2 shadow-sm`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {status.replace("_", " ")}
            </p>
            <p className="text-xl font-semibold leading-none text-foreground">{statusCounts[status] ?? 0}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="q">
                Search
              </label>
              <Input id="q" name="q" placeholder="Search by tag, serial, brand" defaultValue={filters.q} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="category">
                Category
              </label>
              <Input id="category" name="category" placeholder="Laptop" defaultValue={filters.category} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="location">
                Location
              </label>
              <Input id="location" name="location" placeholder="NYC HQ" defaultValue={filters.location} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Status</label>
              <div className="flex flex-wrap gap-2">
                {Object.values(AssetStatus).map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="status"
                      value={status}
                      defaultChecked={statusFilters.includes(status)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    {status.replace("_", " ")}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="sort">
                Sort by
              </label>
              <Select id="sort" name="sort" defaultValue={filters.sort ?? "updatedAt"}>
                <option value="updatedAt">Updated</option>
                <option value="createdAt">Created</option>
                <option value="assetTag">Asset tag</option>
                <option value="purchaseDate">Purchase date</option>
                <option value="warrantyEnd">Warranty end</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="direction">
                Direction
              </label>
              <Select id="direction" name="direction" defaultValue={filters.direction ?? "desc"}>
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="invisible text-sm font-medium text-foreground">Actions</span>
              <div className="flex items-center gap-2">
                <Button type="submit" className="h-10 w-full px-3">
                  Apply
                </Button>
                <Link
                  href={`/w/${params.workspaceId}/assets`}
                  className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
                >
                  Clear
                </Link>
              </div>
            </div>
          </form>
          <ImportExportBar workspaceId={params.workspaceId} exportUrl={exportUrl} />
        </CardContent>
      </Card>

      <AssetListToggle count={assets.length} defaultOpen={false}>
      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Purchase</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const secondary = asset.model ?? asset.category;
                const secondaryLabel = asset.model ? secondary : formatCategoryLabel(secondary);
                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{formatAssetTag(asset.assetTag)}</p>
                        <p className="text-sm text-muted-foreground">
                          {[asset.brand, secondaryLabel].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AssetStatusBadge status={asset.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{asset.assignedTo?.name ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{asset.location ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {asset.purchaseDate ? format(asset.purchaseDate, "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/w/${params.workspaceId}/assets/${asset.id}`}
                        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No assets match this filter yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </AssetListToggle>

      <AiWorkspace workspaceId={params.workspaceId} />
    </div>
  );
}



