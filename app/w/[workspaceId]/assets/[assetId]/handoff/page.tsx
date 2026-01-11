"use server";

import { format } from "date-fns";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getAsset } from "@/lib/assets";
import { prisma } from "@/lib/prisma";
import { effectiveRole } from "@/lib/rbac";
import { PrintControls } from "./print-controls";

function formatDate(value?: Date | null) {
  return value ? format(value, "yyyy-MM-dd") : "—";
}

export default async function AssetHandoffPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
    include: { workspace: true },
  });
  if (!membership) redirect("/login");

  const role = effectiveRole(session.user.role, membership.role);
  const asset = await getAsset(params.workspaceId, params.assetId);
  if (!asset) redirect(`/w/${params.workspaceId}/assets`);
  const isIPad = asset.category?.toLowerCase() === "ipad";
  if (!isIPad) redirect(`/w/${params.workspaceId}/assets`);

  const generatedAt = new Date();
  const assignee = asset.assignedTo;
  const deviceName = asset.assetTag ?? asset.model ?? asset.category ?? "Device";
  const deviceModel = asset.model ?? "—";
  const serial = asset.serialNumber ?? "—";
  const accessories = (asset as any).accessories ?? "—";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-10 text-slate-100 print:bg-white print:text-black">
      <div className="mx-auto max-w-7xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-10 shadow-2xl backdrop-blur print:max-w-none print:border-none print:bg-white print:shadow-none print:p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">IT Asset Acceptance Form</p>
            <h1 className="text-2xl font-semibold text-white">Asset handoff</h1>
            <p className="text-sm text-slate-300">Workspace: {membership.workspace.name}</p>
          </div>
          <p className="text-xs text-slate-400">Generated: {format(generatedAt, "yyyy-MM-dd HH:mm")}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-800/60 p-4 print:border-neutral-200 print:bg-neutral-50">
            <h2 className="text-sm font-semibold text-white print:text-neutral-900">Employee Information</h2>
            <div className="space-y-1 text-sm text-slate-200 print:text-neutral-700">
              <p>
                <span className="font-medium">Full Name:</span> {assignee?.name ?? "Unassigned"}
              </p>
              <p>
                <span className="font-medium">Email:</span> {assignee?.email ?? "—"}
              </p>
              <p>
                <span className="font-medium">Dept / Title:</span> {assignee?.title ?? "—"}
            </p>
            <p>
              <span className="font-medium">Start date:</span> {formatDate(generatedAt)}
            </p>
          </div>
        </div>

          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-800/60 p-4 print:border-neutral-200 print:bg-neutral-50">
            <h2 className="text-sm font-semibold text-white print:text-neutral-900">Device Detail</h2>
            <div className="space-y-1 text-sm text-slate-200 print:text-neutral-700">
              <p>
                <span className="font-medium">Device name:</span> {deviceName}
              </p>
              <p>
                <span className="font-medium">Device model:</span> {deviceModel}
              </p>
              <p>
                <span className="font-medium">Serial number:</span> {serial}
              </p>
              <p>
                <span className="font-medium">Accessories:</span> {accessories}
              </p>
              <p>
                <span className="font-medium">Purchase date:</span> {formatDate(asset.purchaseDate)}
              </p>
              <p>
                <span className="font-medium">Warranty end:</span> {formatDate(asset.warrantyEnd)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-amber-300/60 bg-amber-100/20 p-5 print:border-amber-200 print:bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-200 print:text-amber-900">Review copy only</h2>
          <p className="text-sm leading-relaxed text-amber-100 print:text-amber-900">
            This handoff is for viewing and review purposes only. Signatures and acknowledgements are captured elsewhere.
          </p>
        </div>

        <div className="flex items-center justify-end gap-4 print:hidden">
          <PrintControls workspaceId={params.workspaceId} assetId={params.assetId} />
        </div>
      </div>
    </div>
  );
}
