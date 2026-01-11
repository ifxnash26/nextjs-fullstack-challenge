import { AssetStatus } from "@prisma/client";
import { SortBy } from "@/server/ai/filterSpec";
import { AssetFilterInput, FilterSpec } from "./validators";

const statusKeywords: Record<AssetStatus, string[]> = {
  [AssetStatus.IN_STOCK]: ["in stock", "in-stock", "in_stock", "available", "inventory"],
  [AssetStatus.ASSIGNED]: ["assigned", "in use", "in-use", "in_use", "checked out", "checked-out"],
  [AssetStatus.REPAIR]: ["repair", "repairs", "fix", "broken", "needs repair"],
  [AssetStatus.RETIRED]: ["retired", "decommissioned", "disposed"],
};

const updateVerbs = ["change", "update", "set", "mark", "make", "move", "switch", "assign", "reassign"];
const assignVerbs = ["assign", "reassign"];
const deleteVerbs = ["delete", "remove", "erase", "wipe", "purge", "destroy", "drop"];
const createVerbs = ["add", "create", "register"];
const filterVerbs = ["show", "list", "find", "search", "display", "see", "view", "get", "fetch", "give"];
const unitWords = ["unit", "units", "pcs", "pieces", "items", "assets", "asset", "devices", "device"];
const fillerWords = ["all", "every", "asset", "assets", "item", "items", "device", "devices", "status"];
const tagLikeTokenPattern = /^[a-z]+[a-z0-9_-]*\d+$/i;
const filterFillerWords = [
  "me",
  "please",
  "pls",
  "for",
  "to",
  "all",
  "any",
  "the",
  "a",
  "an",
  "my",
  "our",
  "your",
  "assets",
  "asset",
  "items",
  "item",
  "devices",
  "device",
];

const filterStopWords = new Set([...filterVerbs, ...filterFillerWords]);

const statusKeywordToStatus = Object.entries(statusKeywords).reduce<Record<string, AssetStatus>>((acc, [status, keywords]) => {
  keywords.forEach((keyword) => {
    acc[keyword] = status as AssetStatus;
  });
  return acc;
}, {});

const statusKeywordList = Object.keys(statusKeywordToStatus).sort((a, b) => b.length - a.length);
const statusKeywordPattern = statusKeywordList.map(escapeRegExp).join("|");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looksLikeAssetTag(value: string) {
  return tagLikeTokenPattern.test(value);
}

function createStatusRegex(flags: string) {
  return new RegExp(`\\b(?:${statusKeywordPattern})\\b`, flags);
}

function hasUpdateVerb(text: string) {
  const verbPattern = updateVerbs.map(escapeRegExp).join("|");
  return new RegExp(`\\b(?:${verbPattern})\\b`, "i").test(text);
}

function hasDeleteVerb(text: string) {
  const verbPattern = deleteVerbs.map(escapeRegExp).join("|");
  return new RegExp(`\\b(?:${verbPattern})\\b`, "i").test(text);
}

function hasAssignVerb(text: string) {
  const verbPattern = assignVerbs.map(escapeRegExp).join("|");
  return new RegExp(`\\b(?:${verbPattern})\\b`, "i").test(text);
}

function hasCreateVerb(text: string) {
  const verbPattern = createVerbs.map(escapeRegExp).join("|");
  return new RegExp(`\\b(?:${verbPattern})\\b`, "i").test(text);
}

function findStatusMatches(text: string) {
  const matches = text.matchAll(createStatusRegex("g"));
  const found: AssetStatus[] = [];
  for (const match of matches) {
    const keyword = match[0].toLowerCase();
    const status = statusKeywordToStatus[keyword];
    if (status) found.push(status);
  }
  return Array.from(new Set(found));
}

function extractTargetStatus(text: string) {
  const target = text.match(new RegExp(`\\b(?:to|as|status)\\s+(${statusKeywordPattern})\\b`, "i"));
  if (target?.[1]) {
    return statusKeywordToStatus[target[1].toLowerCase()] ?? null;
  }

  const matches = findStatusMatches(text);
  return matches.length === 1 ? matches[0] : null;Error: 
  × the name `Link` is defined multiple times
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:135:1]
 135 │     </div>
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
     ·        ──┬─
     ·          ╰── previous definition of `Link` here
 139 │  "use client";
 140 │ 
 141 │ import Link from "next/link";
     ·        ──┬─
     ·          ╰── `Link` redefined here
 142 │ import { format } from "date-fns";
 143 │ import { AiWorkspace } from "@/components/ai-workspace";
 144 │ import { getAsset } from "@/lib/assets";
     ╰────

  × the name `format` is defined multiple times
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:1:1]
   1 │ import { redirect } from "next/navigation";
   2 │ import { format } from "date-fns";
     ·          ───┬──
     ·             ╰── previous definition of `format` here
   3 │ import { AiWorkspace } from "@/components/ai-workspace";
   4 │ import { getCurrentSession } from "@/lib/auth";
   5 │ import { getAsset } from "@/lib/assets";
   6 │ import { prisma } from "@/lib/prisma";
   7 │ import { effectiveRole } from "@/lib/rbac";
   8 │ 
   9 │ function formatDate(value?: Date | null) {
  10 │   return value ? format(value, "yyyy-MM-dd") : "-";
  11 │ }
  12 │ 
  13 │ export default async function AssetHandoffPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  14 │   const session = await getCurrentSession();
  15 │   if (!session?.user?.id) redirect("/login");
  16 │ 
  17 │   const membership = await prisma.workspaceMember.findUnique({
  18 │     where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  19 │     include: { workspace: true },
  20 │   });
  21 │   if (!membership) redirect("/login");
  22 │ 
  23 │   const role = effectiveRole(session.user.role, membership.role);
  24 │   const asset = await getAsset(params.workspaceId, params.assetId);
  25 │   if (!asset) redirect(`/w/${params.workspaceId}/assets`);
  26 │ 
  27 │   const assignee = asset.assignedTo;
  28 │ 
  29 │   const deviceName = asset.assetTag ?? asset.model ?? asset.category ?? "Device";
  30 │   const deviceModel = asset.model ?? "-";
  31 │   const serial = asset.serialNumber ?? "-";
  32 │   const accessories = (asset as any).accessories ?? "-";
  33 │ 
  34 │   return (
  35 │     <div className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0">
  36 │       <div className="flex items-start justify-between gap-4">
  37 │         <div>
  38 │           <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">IT Asset Acceptance Form</p>
  39 │           <h1 className="text-2xl font-semibold text-neutral-900">Asset handoff</h1>
  40 │           <p className="text-sm text-neutral-600">Workspace: {membership.workspace.name}</p>
  41 │         </div>
  42 │         <div className="space-y-2 text-right">
  43 │           <p className="text-xs text-neutral-500">Generated: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
  44 │         </div>
  45 │       </div>
  46 │ 
  47 │       <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  48 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  49 │           <h2 className="text-sm font-semibold text-neutral-900">Employee Information</h2>
  50 │           <div className="space-y-1 text-sm text-neutral-700">
  51 │             <p>
  52 │               <span className="font-medium">Full Name:</span> {assignee?.name ?? "Unassigned"}
  53 │             </p>
  54 │             <p>
  55 │               <span className="font-medium">Email:</span> {assignee?.email ?? "—"}
  56 │             </p>
  57 │             <p>
  58 │               <span className="font-medium">Dept / Title:</span> {assignee?.title ?? "—"}
  59 │             </p>
  60 │             <p>
  61 │               <span className="font-medium">Start date:</span> —
  62 │             </p>
  63 │           </div>
  64 │         </div>
  65 │ 
  66 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  67 │           <h2 className="text-sm font-semibold text-neutral-900">Device Detail</h2>
  68 │           <div className="space-y-1 text-sm text-neutral-700">
  69 │             <p>
  70 │               <span className="font-medium">Device name:</span> {deviceName}
  71 │             </p>
  72 │             <p>
  73 │               <span className="font-medium">Device model:</span> {deviceModel}
  74 │             </p>
  75 │             <p>
  76 │               <span className="font-medium">Serial number:</span> {serial}
  77 │             </p>
  78 │             <p>
  79 │               <span className="font-medium">Accessories:</span> {accessories}
  80 │             </p>
  81 │             <p>
  82 │               <span className="font-medium">Purchase date:</span> {formatDate(asset.purchaseDate)}
  83 │             </p>
  84 │             <p>
  85 │               <span className="font-medium">Warranty end:</span> {formatDate(asset.warrantyEnd)}
  86 │             </p>
  87 │           </div>
  88 │         </div>
  89 │       </div>
  90 │ 
  91 │       <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  92 │         <h2 className="text-sm font-semibold text-neutral-900">Acknowledgment</h2>
  93 │         <p className="text-sm leading-relaxed text-neutral-700">
  94 │           I acknowledge receipt of the above IT assets and confirm that they are in good working condition unless stated
  95 │           otherwise. I understand my responsibilities for safekeeping and proper use of these assets in accordance with
  96 │           company policies. In the event of asset loss, I will immediately report to the IT team to prevent unauthorized
  97 │           access.
  98 │         </p>
  99 │         <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
 100 │           <div className="space-y-2">
 101 │             <p className="text-sm font-medium text-neutral-800">User signature</p>
 102 │             <div className="h-12 border-b border-neutral-300" />
 103 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 104 │           </div>
 105 │           <div className="space-y-2">
 106 │             <p className="text-sm font-medium text-neutral-800">IT representative signature</p>
 107 │             <div className="h-12 border-b border-neutral-300" />
 108 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 109 │           </div>
 110 │         </div>
 111 │       </div>
 112 │ 
 113 │       <div className="print:hidden">
 114 │         <AiWorkspace workspaceId={params.workspaceId} assetId={params.assetId} />
 115 │       </div>
 116 │ 
 117 │       <div className="fixed bottom-4 right-4 flex items-center gap-3 print:hidden">
 118 │         <Link
 119 │           href="#"
 120 │           onClick={(e) => {
 121 │             e.preventDefault();
 122 │             if (typeof window !== "undefined") window.print();
 123 │           }}
 124 │           className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
 125 │         >
 126 │           Download PDF
 127 │         </Link>
 128 │         <Link
 129 │           href={`/w/${params.workspaceId}/assets/${params.assetId}`}
 130 │           className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
 131 │         >
 132 │           Back to asset
 133 │         </Link>
 134 │       </div>
 135 │     </div>
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
 139 │  "use client";
 140 │ 
 141 │ import Link from "next/link";
 142 │ import { format } from "date-fns";
     ·          ───┬──
     ·             ╰── `format` redefined here
 143 │ import { AiWorkspace } from "@/components/ai-workspace";
 144 │ import { getAsset } from "@/lib/assets";
 145 │ import { prisma } from "@/lib/prisma";
     ╰────

  × the name `AiWorkspace` is defined multiple times
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:1:1]
   1 │ import { redirect } from "next/navigation";
   2 │ import { format } from "date-fns";
   3 │ import { AiWorkspace } from "@/components/ai-workspace";
     ·          ─────┬─────
     ·               ╰── previous definition of `AiWorkspace` here
   4 │ import { getCurrentSession } from "@/lib/auth";
   5 │ import { getAsset } from "@/lib/assets";
   6 │ import { prisma } from "@/lib/prisma";
   7 │ import { effectiveRole } from "@/lib/rbac";
   8 │ 
   9 │ function formatDate(value?: Date | null) {
  10 │   return value ? format(value, "yyyy-MM-dd") : "-";
  11 │ }
  12 │ 
  13 │ export default async function AssetHandoffPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  14 │   const session = await getCurrentSession();
  15 │   if (!session?.user?.id) redirect("/login");
  16 │ 
  17 │   const membership = await prisma.workspaceMember.findUnique({
  18 │     where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  19 │     include: { workspace: true },
  20 │   });
  21 │   if (!membership) redirect("/login");
  22 │ 
  23 │   const role = effectiveRole(session.user.role, membership.role);
  24 │   const asset = await getAsset(params.workspaceId, params.assetId);
  25 │   if (!asset) redirect(`/w/${params.workspaceId}/assets`);
  26 │ 
  27 │   const assignee = asset.assignedTo;
  28 │ 
  29 │   const deviceName = asset.assetTag ?? asset.model ?? asset.category ?? "Device";
  30 │   const deviceModel = asset.model ?? "-";
  31 │   const serial = asset.serialNumber ?? "-";
  32 │   const accessories = (asset as any).accessories ?? "-";
  33 │ 
  34 │   return (
  35 │     <div className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0">
  36 │       <div className="flex items-start justify-between gap-4">
  37 │         <div>
  38 │           <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">IT Asset Acceptance Form</p>
  39 │           <h1 className="text-2xl font-semibold text-neutral-900">Asset handoff</h1>
  40 │           <p className="text-sm text-neutral-600">Workspace: {membership.workspace.name}</p>
  41 │         </div>
  42 │         <div className="space-y-2 text-right">
  43 │           <p className="text-xs text-neutral-500">Generated: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
  44 │         </div>
  45 │       </div>
  46 │ 
  47 │       <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  48 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  49 │           <h2 className="text-sm font-semibold text-neutral-900">Employee Information</h2>
  50 │           <div className="space-y-1 text-sm text-neutral-700">
  51 │             <p>
  52 │               <span className="font-medium">Full Name:</span> {assignee?.name ?? "Unassigned"}
  53 │             </p>
  54 │             <p>
  55 │               <span className="font-medium">Email:</span> {assignee?.email ?? "—"}
  56 │             </p>
  57 │             <p>
  58 │               <span className="font-medium">Dept / Title:</span> {assignee?.title ?? "—"}
  59 │             </p>
  60 │             <p>
  61 │               <span className="font-medium">Start date:</span> —
  62 │             </p>
  63 │           </div>
  64 │         </div>
  65 │ 
  66 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  67 │           <h2 className="text-sm font-semibold text-neutral-900">Device Detail</h2>
  68 │           <div className="space-y-1 text-sm text-neutral-700">
  69 │             <p>
  70 │               <span className="font-medium">Device name:</span> {deviceName}
  71 │             </p>
  72 │             <p>
  73 │               <span className="font-medium">Device model:</span> {deviceModel}
  74 │             </p>
  75 │             <p>
  76 │               <span className="font-medium">Serial number:</span> {serial}
  77 │             </p>
  78 │             <p>
  79 │               <span className="font-medium">Accessories:</span> {accessories}
  80 │             </p>
  81 │             <p>
  82 │               <span className="font-medium">Purchase date:</span> {formatDate(asset.purchaseDate)}
  83 │             </p>
  84 │             <p>
  85 │               <span className="font-medium">Warranty end:</span> {formatDate(asset.warrantyEnd)}
  86 │             </p>
  87 │           </div>
  88 │         </div>
  89 │       </div>
  90 │ 
  91 │       <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  92 │         <h2 className="text-sm font-semibold text-neutral-900">Acknowledgment</h2>
  93 │         <p className="text-sm leading-relaxed text-neutral-700">
  94 │           I acknowledge receipt of the above IT assets and confirm that they are in good working condition unless stated
  95 │           otherwise. I understand my responsibilities for safekeeping and proper use of these assets in accordance with
  96 │           company policies. In the event of asset loss, I will immediately report to the IT team to prevent unauthorized
  97 │           access.
  98 │         </p>
  99 │         <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
 100 │           <div className="space-y-2">
 101 │             <p className="text-sm font-medium text-neutral-800">User signature</p>
 102 │             <div className="h-12 border-b border-neutral-300" />
 103 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 104 │           </div>
 105 │           <div className="space-y-2">
 106 │             <p className="text-sm font-medium text-neutral-800">IT representative signature</p>
 107 │             <div className="h-12 border-b border-neutral-300" />
 108 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 109 │           </div>
 110 │         </div>
 111 │       </div>
 112 │ 
 113 │       <div className="print:hidden">
 114 │         <AiWorkspace workspaceId={params.workspaceId} assetId={params.assetId} />
 115 │       </div>
 116 │ 
 117 │       <div className="fixed bottom-4 right-4 flex items-center gap-3 print:hidden">
 118 │         <Link
 119 │           href="#"
 120 │           onClick={(e) => {
 121 │             e.preventDefault();
 122 │             if (typeof window !== "undefined") window.print();
 123 │           }}
 124 │           className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
 125 │         >
 126 │           Download PDF
 127 │         </Link>
 128 │         <Link
 129 │           href={`/w/${params.workspaceId}/assets/${params.assetId}`}
 130 │           className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
 131 │         >
 132 │           Back to asset
 133 │         </Link>
 134 │       </div>
 135 │     </div>
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
 139 │  "use client";
 140 │ 
 141 │ import Link from "next/link";
 142 │ import { format } from "date-fns";
 143 │ import { AiWorkspace } from "@/components/ai-workspace";
     ·          ─────┬─────
     ·               ╰── `AiWorkspace` redefined here
 144 │ import { getAsset } from "@/lib/assets";
 145 │ import { prisma } from "@/lib/prisma";
 146 │ import { getCurrentSession } from "@/lib/auth";
     ╰────

  × the name `getAsset` is defined multiple times
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:2:1]
   2 │ import { format } from "date-fns";
   3 │ import { AiWorkspace } from "@/components/ai-workspace";
   4 │ import { getCurrentSession } from "@/lib/auth";
   5 │ import { getAsset } from "@/lib/assets";
     ·          ────┬───
     ·              ╰── previous definition of `getAsset` here
   6 │ import { prisma } from "@/lib/prisma";
   7 │ import { effectiveRole } from "@/lib/rbac";
   8 │ 
   9 │ function formatDate(value?: Date | null) {
  10 │   return value ? format(value, "yyyy-MM-dd") : "-";
  11 │ }
  12 │ 
  13 │ export default async function AssetHandoffPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  14 │   const session = await getCurrentSession();
  15 │   if (!session?.user?.id) redirect("/login");
  16 │ 
  17 │   const membership = await prisma.workspaceMember.findUnique({
  18 │     where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  19 │     include: { workspace: true },
  20 │   });
  21 │   if (!membership) redirect("/login");
  22 │ 
  23 │   const role = effectiveRole(session.user.role, membership.role);
  24 │   const asset = await getAsset(params.workspaceId, params.assetId);
  25 │   if (!asset) redirect(`/w/${params.workspaceId}/assets`);
  26 │ 
  27 │   const assignee = asset.assignedTo;
  28 │ 
  29 │   const deviceName = asset.assetTag ?? asset.model ?? asset.category ?? "Device";
  30 │   const deviceModel = asset.model ?? "-";
  31 │   const serial = asset.serialNumber ?? "-";
  32 │   const accessories = (asset as any).accessories ?? "-";
  33 │ 
  34 │   return (
  35 │     <div className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0">
  36 │       <div className="flex items-start justify-between gap-4">
  37 │         <div>
  38 │           <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">IT Asset Acceptance Form</p>
  39 │           <h1 className="text-2xl font-semibold text-neutral-900">Asset handoff</h1>
  40 │           <p className="text-sm text-neutral-600">Workspace: {membership.workspace.name}</p>
  41 │         </div>
  42 │         <div className="space-y-2 text-right">
  43 │           <p className="text-xs text-neutral-500">Generated: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
  44 │         </div>
  45 │       </div>
  46 │ 
  47 │       <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  48 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  49 │           <h2 className="text-sm font-semibold text-neutral-900">Employee Information</h2>
  50 │           <div className="space-y-1 text-sm text-neutral-700">
  51 │             <p>
  52 │               <span className="font-medium">Full Name:</span> {assignee?.name ?? "Unassigned"}
  53 │             </p>
  54 │             <p>
  55 │               <span className="font-medium">Email:</span> {assignee?.email ?? "—"}
  56 │             </p>
  57 │             <p>
  58 │               <span className="font-medium">Dept / Title:</span> {assignee?.title ?? "—"}
  59 │             </p>
  60 │             <p>
  61 │               <span className="font-medium">Start date:</span> —
  62 │             </p>
  63 │           </div>
  64 │         </div>
  65 │ 
  66 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  67 │           <h2 className="text-sm font-semibold text-neutral-900">Device Detail</h2>
  68 │           <div className="space-y-1 text-sm text-neutral-700">
  69 │             <p>
  70 │               <span className="font-medium">Device name:</span> {deviceName}
  71 │             </p>
  72 │             <p>
  73 │               <span className="font-medium">Device model:</span> {deviceModel}
  74 │             </p>
  75 │             <p>
  76 │               <span className="font-medium">Serial number:</span> {serial}
  77 │             </p>
  78 │             <p>
  79 │               <span className="font-medium">Accessories:</span> {accessories}
  80 │             </p>
  81 │             <p>
  82 │               <span className="font-medium">Purchase date:</span> {formatDate(asset.purchaseDate)}
  83 │             </p>
  84 │             <p>
  85 │               <span className="font-medium">Warranty end:</span> {formatDate(asset.warrantyEnd)}
  86 │             </p>
  87 │           </div>
  88 │         </div>
  89 │       </div>
  90 │ 
  91 │       <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  92 │         <h2 className="text-sm font-semibold text-neutral-900">Acknowledgment</h2>
  93 │         <p className="text-sm leading-relaxed text-neutral-700">
  94 │           I acknowledge receipt of the above IT assets and confirm that they are in good working condition unless stated
  95 │           otherwise. I understand my responsibilities for safekeeping and proper use of these assets in accordance with
  96 │           company policies. In the event of asset loss, I will immediately report to the IT team to prevent unauthorized
  97 │           access.
  98 │         </p>
  99 │         <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
 100 │           <div className="space-y-2">
 101 │             <p className="text-sm font-medium text-neutral-800">User signature</p>
 102 │             <div className="h-12 border-b border-neutral-300" />
 103 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 104 │           </div>
 105 │           <div className="space-y-2">
 106 │             <p className="text-sm font-medium text-neutral-800">IT representative signature</p>
 107 │             <div className="h-12 border-b border-neutral-300" />
 108 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 109 │           </div>
 110 │         </div>
 111 │       </div>
 112 │ 
 113 │       <div className="print:hidden">
 114 │         <AiWorkspace workspaceId={params.workspaceId} assetId={params.assetId} />
 115 │       </div>
 116 │ 
 117 │       <div className="fixed bottom-4 right-4 flex items-center gap-3 print:hidden">
 118 │         <Link
 119 │           href="#"
 120 │           onClick={(e) => {
 121 │             e.preventDefault();
 122 │             if (typeof window !== "undefined") window.print();
 123 │           }}
 124 │           className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
 125 │         >
 126 │           Download PDF
 127 │         </Link>
 128 │         <Link
 129 │           href={`/w/${params.workspaceId}/assets/${params.assetId}`}
 130 │           className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
 131 │         >
 132 │           Back to asset
 133 │         </Link>
 134 │       </div>
 135 │     </div>
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
 139 │  "use client";
 140 │ 
 141 │ import Link from "next/link";
 142 │ import { format } from "date-fns";
 143 │ import { AiWorkspace } from "@/components/ai-workspace";
 144 │ import { getAsset } from "@/lib/assets";
     ·          ────┬───
     ·              ╰── `getAsset` redefined here
 145 │ import { prisma } from "@/lib/prisma";
 146 │ import { getCurrentSession } from "@/lib/auth";
 147 │ import { effectiveRole } from "@/lib/rbac";
     ╰────

  × the name `prisma` is defined multiple times
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:3:1]
   3 │ import { AiWorkspace } from "@/components/ai-workspace";
   4 │ import { getCurrentSession } from "@/lib/auth";
   5 │ import { getAsset } from "@/lib/assets";
   6 │ import { prisma } from "@/lib/prisma";
     ·          ───┬──
     ·             ╰── previous definition of `prisma` here
   7 │ import { effectiveRole } from "@/lib/rbac";
   8 │ 
   9 │ function formatDate(value?: Date | null) {
  10 │   return value ? format(value, "yyyy-MM-dd") : "-";
  11 │ }
  12 │ 
  13 │ export default async function AssetHandoffPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  14 │   const session = await getCurrentSession();
  15 │   if (!session?.user?.id) redirect("/login");
  16 │ 
  17 │   const membership = await prisma.workspaceMember.findUnique({
  18 │     where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  19 │     include: { workspace: true },
  20 │   });
  21 │   if (!membership) redirect("/login");
  22 │ 
  23 │   const role = effectiveRole(session.user.role, membership.role);
  24 │   const asset = await getAsset(params.workspaceId, params.assetId);
  25 │   if (!asset) redirect(`/w/${params.workspaceId}/assets`);
  26 │ 
  27 │   const assignee = asset.assignedTo;
  28 │ 
  29 │   const deviceName = asset.assetTag ?? asset.model ?? asset.category ?? "Device";
  30 │   const deviceModel = asset.model ?? "-";
  31 │   const serial = asset.serialNumber ?? "-";
  32 │   const accessories = (asset as any).accessories ?? "-";
  33 │ 
  34 │   return (
  35 │     <div className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0">
  36 │       <div className="flex items-start justify-between gap-4">
  37 │         <div>
  38 │           <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">IT Asset Acceptance Form</p>
  39 │           <h1 className="text-2xl font-semibold text-neutral-900">Asset handoff</h1>
  40 │           <p className="text-sm text-neutral-600">Workspace: {membership.workspace.name}</p>
  41 │         </div>
  42 │         <div className="space-y-2 text-right">
  43 │           <p className="text-xs text-neutral-500">Generated: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
  44 │         </div>
  45 │       </div>
  46 │ 
  47 │       <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  48 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  49 │           <h2 className="text-sm font-semibold text-neutral-900">Employee Information</h2>
  50 │           <div className="space-y-1 text-sm text-neutral-700">
  51 │             <p>
  52 │               <span className="font-medium">Full Name:</span> {assignee?.name ?? "Unassigned"}
  53 │             </p>
  54 │             <p>
  55 │               <span className="font-medium">Email:</span> {assignee?.email ?? "—"}
  56 │             </p>
  57 │             <p>
  58 │               <span className="font-medium">Dept / Title:</span> {assignee?.title ?? "—"}
  59 │             </p>
  60 │             <p>
  61 │               <span className="font-medium">Start date:</span> —
  62 │             </p>
  63 │           </div>
  64 │         </div>
  65 │ 
  66 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  67 │           <h2 className="text-sm font-semibold text-neutral-900">Device Detail</h2>
  68 │           <div className="space-y-1 text-sm text-neutral-700">
  69 │             <p>
  70 │               <span className="font-medium">Device name:</span> {deviceName}
  71 │             </p>
  72 │             <p>
  73 │               <span className="font-medium">Device model:</span> {deviceModel}
  74 │             </p>
  75 │             <p>
  76 │               <span className="font-medium">Serial number:</span> {serial}
  77 │             </p>
  78 │             <p>
  79 │               <span className="font-medium">Accessories:</span> {accessories}
  80 │             </p>
  81 │             <p>
  82 │               <span className="font-medium">Purchase date:</span> {formatDate(asset.purchaseDate)}
  83 │             </p>
  84 │             <p>
  85 │               <span className="font-medium">Warranty end:</span> {formatDate(asset.warrantyEnd)}
  86 │             </p>
  87 │           </div>
  88 │         </div>
  89 │       </div>
  90 │ 
  91 │       <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  92 │         <h2 className="text-sm font-semibold text-neutral-900">Acknowledgment</h2>
  93 │         <p className="text-sm leading-relaxed text-neutral-700">
  94 │           I acknowledge receipt of the above IT assets and confirm that they are in good working condition unless stated
  95 │           otherwise. I understand my responsibilities for safekeeping and proper use of these assets in accordance with
  96 │           company policies. In the event of asset loss, I will immediately report to the IT team to prevent unauthorized
  97 │           access.
  98 │         </p>
  99 │         <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
 100 │           <div className="space-y-2">
 101 │             <p className="text-sm font-medium text-neutral-800">User signature</p>
 102 │             <div className="h-12 border-b border-neutral-300" />
 103 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 104 │           </div>
 105 │           <div className="space-y-2">
 106 │             <p className="text-sm font-medium text-neutral-800">IT representative signature</p>
 107 │             <div className="h-12 border-b border-neutral-300" />
 108 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 109 │           </div>
 110 │         </div>
 111 │       </div>
 112 │ 
 113 │       <div className="print:hidden">
 114 │         <AiWorkspace workspaceId={params.workspaceId} assetId={params.assetId} />
 115 │       </div>
 116 │ 
 117 │       <div className="fixed bottom-4 right-4 flex items-center gap-3 print:hidden">
 118 │         <Link
 119 │           href="#"
 120 │           onClick={(e) => {
 121 │             e.preventDefault();
 122 │             if (typeof window !== "undefined") window.print();
 123 │           }}
 124 │           className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
 125 │         >
 126 │           Download PDF
 127 │         </Link>
 128 │         <Link
 129 │           href={`/w/${params.workspaceId}/assets/${params.assetId}`}
 130 │           className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
 131 │         >
 132 │           Back to asset
 133 │         </Link>
 134 │       </div>
 135 │     </div>
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
 139 │  "use client";
 140 │ 
 141 │ import Link from "next/link";
 142 │ import { format } from "date-fns";
 143 │ import { AiWorkspace } from "@/components/ai-workspace";
 144 │ import { getAsset } from "@/lib/assets";
 145 │ import { prisma } from "@/lib/prisma";
     ·          ───┬──
     ·             ╰── `prisma` redefined here
 146 │ import { getCurrentSession } from "@/lib/auth";
 147 │ import { effectiveRole } from "@/lib/rbac";
 148 │ import { redirect } from "next/navigation";
     ╰────

  × the name `getCurrentSession` is defined multiple times
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:1:1]
   1 │ import { redirect } from "next/navigation";
   2 │ import { format } from "date-fns";
   3 │ import { AiWorkspace } from "@/components/ai-workspace";
   4 │ import { getCurrentSession } from "@/lib/auth";
     ·          ────────┬────────
     ·                  ╰── previous definition of `getCurrentSession` here
   5 │ import { getAsset } from "@/lib/assets";
   6 │ import { prisma } from "@/lib/prisma";
   7 │ import { effectiveRole } from "@/lib/rbac";
   8 │ 
   9 │ function formatDate(value?: Date | null) {
  10 │   return value ? format(value, "yyyy-MM-dd") : "-";
  11 │ }
  12 │ 
  13 │ export default async function AssetHandoffPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  14 │   const session = await getCurrentSession();
  15 │   if (!session?.user?.id) redirect("/login");
  16 │ 
  17 │   const membership = await prisma.workspaceMember.findUnique({
  18 │     where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  19 │     include: { workspace: true },
  20 │   });
  21 │   if (!membership) redirect("/login");
  22 │ 
  23 │   const role = effectiveRole(session.user.role, membership.role);
  24 │   const asset = await getAsset(params.workspaceId, params.assetId);
  25 │   if (!asset) redirect(`/w/${params.workspaceId}/assets`);
  26 │ 
  27 │   const assignee = asset.assignedTo;
  28 │ 
  29 │   const deviceName = asset.assetTag ?? asset.model ?? asset.category ?? "Device";
  30 │   const deviceModel = asset.model ?? "-";
  31 │   const serial = asset.serialNumber ?? "-";
  32 │   const accessories = (asset as any).accessories ?? "-";
  33 │ 
  34 │   return (
  35 │     <div className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0">
  36 │       <div className="flex items-start justify-between gap-4">
  37 │         <div>
  38 │           <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">IT Asset Acceptance Form</p>
  39 │           <h1 className="text-2xl font-semibold text-neutral-900">Asset handoff</h1>
  40 │           <p className="text-sm text-neutral-600">Workspace: {membership.workspace.name}</p>
  41 │         </div>
  42 │         <div className="space-y-2 text-right">
  43 │           <p className="text-xs text-neutral-500">Generated: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
  44 │         </div>
  45 │       </div>
  46 │ 
  47 │       <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  48 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  49 │           <h2 className="text-sm font-semibold text-neutral-900">Employee Information</h2>
  50 │           <div className="space-y-1 text-sm text-neutral-700">
  51 │             <p>
  52 │               <span className="font-medium">Full Name:</span> {assignee?.name ?? "Unassigned"}
  53 │             </p>
  54 │             <p>
  55 │               <span className="font-medium">Email:</span> {assignee?.email ?? "—"}
  56 │             </p>
  57 │             <p>
  58 │               <span className="font-medium">Dept / Title:</span> {assignee?.title ?? "—"}
  59 │             </p>
  60 │             <p>
  61 │               <span className="font-medium">Start date:</span> —
  62 │             </p>
  63 │           </div>
  64 │         </div>
  65 │ 
  66 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  67 │           <h2 className="text-sm font-semibold text-neutral-900">Device Detail</h2>
  68 │           <div className="space-y-1 text-sm text-neutral-700">
  69 │             <p>
  70 │               <span className="font-medium">Device name:</span> {deviceName}
  71 │             </p>
  72 │             <p>
  73 │               <span className="font-medium">Device model:</span> {deviceModel}
  74 │             </p>
  75 │             <p>
  76 │               <span className="font-medium">Serial number:</span> {serial}
  77 │             </p>
  78 │             <p>
  79 │               <span className="font-medium">Accessories:</span> {accessories}
  80 │             </p>
  81 │             <p>
  82 │               <span className="font-medium">Purchase date:</span> {formatDate(asset.purchaseDate)}
  83 │             </p>
  84 │             <p>
  85 │               <span className="font-medium">Warranty end:</span> {formatDate(asset.warrantyEnd)}
  86 │             </p>
  87 │           </div>
  88 │         </div>
  89 │       </div>
  90 │ 
  91 │       <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  92 │         <h2 className="text-sm font-semibold text-neutral-900">Acknowledgment</h2>
  93 │         <p className="text-sm leading-relaxed text-neutral-700">
  94 │           I acknowledge receipt of the above IT assets and confirm that they are in good working condition unless stated
  95 │           otherwise. I understand my responsibilities for safekeeping and proper use of these assets in accordance with
  96 │           company policies. In the event of asset loss, I will immediately report to the IT team to prevent unauthorized
  97 │           access.
  98 │         </p>
  99 │         <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
 100 │           <div className="space-y-2">
 101 │             <p className="text-sm font-medium text-neutral-800">User signature</p>
 102 │             <div className="h-12 border-b border-neutral-300" />
 103 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 104 │           </div>
 105 │           <div className="space-y-2">
 106 │             <p className="text-sm font-medium text-neutral-800">IT representative signature</p>
 107 │             <div className="h-12 border-b border-neutral-300" />
 108 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 109 │           </div>
 110 │         </div>
 111 │       </div>
 112 │ 
 113 │       <div className="print:hidden">
 114 │         <AiWorkspace workspaceId={params.workspaceId} assetId={params.assetId} />
 115 │       </div>
 116 │ 
 117 │       <div className="fixed bottom-4 right-4 flex items-center gap-3 print:hidden">
 118 │         <Link
 119 │           href="#"
 120 │           onClick={(e) => {
 121 │             e.preventDefault();
 122 │             if (typeof window !== "undefined") window.print();
 123 │           }}
 124 │           className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
 125 │         >
 126 │           Download PDF
 127 │         </Link>
 128 │         <Link
 129 │           href={`/w/${params.workspaceId}/assets/${params.assetId}`}
 130 │           className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
 131 │         >
 132 │           Back to asset
 133 │         </Link>
 134 │       </div>
 135 │     </div>
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
 139 │  "use client";
 140 │ 
 141 │ import Link from "next/link";
 142 │ import { format } from "date-fns";
 143 │ import { AiWorkspace } from "@/components/ai-workspace";
 144 │ import { getAsset } from "@/lib/assets";
 145 │ import { prisma } from "@/lib/prisma";
 146 │ import { getCurrentSession } from "@/lib/auth";
     ·          ────────┬────────
     ·                  ╰── `getCurrentSession` redefined here
 147 │ import { effectiveRole } from "@/lib/rbac";
 148 │ import { redirect } from "next/navigation";
     ╰────

  × the name `effectiveRole` is defined multiple times
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:4:1]
   4 │ import { getCurrentSession } from "@/lib/auth";
   5 │ import { getAsset } from "@/lib/assets";
   6 │ import { prisma } from "@/lib/prisma";
   7 │ import { effectiveRole } from "@/lib/rbac";
     ·          ──────┬──────
     ·                ╰── previous definition of `effectiveRole` here
   8 │ 
   9 │ function formatDate(value?: Date | null) {
  10 │   return value ? format(value, "yyyy-MM-dd") : "-";
  11 │ }
  12 │ 
  13 │ export default async function AssetHandoffPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  14 │   const session = await getCurrentSession();
  15 │   if (!session?.user?.id) redirect("/login");
  16 │ 
  17 │   const membership = await prisma.workspaceMember.findUnique({
  18 │     where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  19 │     include: { workspace: true },
  20 │   });
  21 │   if (!membership) redirect("/login");
  22 │ 
  23 │   const role = effectiveRole(session.user.role, membership.role);
  24 │   const asset = await getAsset(params.workspaceId, params.assetId);
  25 │   if (!asset) redirect(`/w/${params.workspaceId}/assets`);
  26 │ 
  27 │   const assignee = asset.assignedTo;
  28 │ 
  29 │   const deviceName = asset.assetTag ?? asset.model ?? asset.category ?? "Device";
  30 │   const deviceModel = asset.model ?? "-";
  31 │   const serial = asset.serialNumber ?? "-";
  32 │   const accessories = (asset as any).accessories ?? "-";
  33 │ 
  34 │   return (
  35 │     <div className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0">
  36 │       <div className="flex items-start justify-between gap-4">
  37 │         <div>
  38 │           <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">IT Asset Acceptance Form</p>
  39 │           <h1 className="text-2xl font-semibold text-neutral-900">Asset handoff</h1>
  40 │           <p className="text-sm text-neutral-600">Workspace: {membership.workspace.name}</p>
  41 │         </div>
  42 │         <div className="space-y-2 text-right">
  43 │           <p className="text-xs text-neutral-500">Generated: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
  44 │         </div>
  45 │       </div>
  46 │ 
  47 │       <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  48 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  49 │           <h2 className="text-sm font-semibold text-neutral-900">Employee Information</h2>
  50 │           <div className="space-y-1 text-sm text-neutral-700">
  51 │             <p>
  52 │               <span className="font-medium">Full Name:</span> {assignee?.name ?? "Unassigned"}
  53 │             </p>
  54 │             <p>
  55 │               <span className="font-medium">Email:</span> {assignee?.email ?? "—"}
  56 │             </p>
  57 │             <p>
  58 │               <span className="font-medium">Dept / Title:</span> {assignee?.title ?? "—"}
  59 │             </p>
  60 │             <p>
  61 │               <span className="font-medium">Start date:</span> —
  62 │             </p>
  63 │           </div>
  64 │         </div>
  65 │ 
  66 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  67 │           <h2 className="text-sm font-semibold text-neutral-900">Device Detail</h2>
  68 │           <div className="space-y-1 text-sm text-neutral-700">
  69 │             <p>
  70 │               <span className="font-medium">Device name:</span> {deviceName}
  71 │             </p>
  72 │             <p>
  73 │               <span className="font-medium">Device model:</span> {deviceModel}
  74 │             </p>
  75 │             <p>
  76 │               <span className="font-medium">Serial number:</span> {serial}
  77 │             </p>
  78 │             <p>
  79 │               <span className="font-medium">Accessories:</span> {accessories}
  80 │             </p>
  81 │             <p>
  82 │               <span className="font-medium">Purchase date:</span> {formatDate(asset.purchaseDate)}
  83 │             </p>
  84 │             <p>
  85 │               <span className="font-medium">Warranty end:</span> {formatDate(asset.warrantyEnd)}
  86 │             </p>
  87 │           </div>
  88 │         </div>
  89 │       </div>
  90 │ 
  91 │       <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  92 │         <h2 className="text-sm font-semibold text-neutral-900">Acknowledgment</h2>
  93 │         <p className="text-sm leading-relaxed text-neutral-700">
  94 │           I acknowledge receipt of the above IT assets and confirm that they are in good working condition unless stated
  95 │           otherwise. I understand my responsibilities for safekeeping and proper use of these assets in accordance with
  96 │           company policies. In the event of asset loss, I will immediately report to the IT team to prevent unauthorized
  97 │           access.
  98 │         </p>
  99 │         <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
 100 │           <div className="space-y-2">
 101 │             <p className="text-sm font-medium text-neutral-800">User signature</p>
 102 │             <div className="h-12 border-b border-neutral-300" />
 103 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 104 │           </div>
 105 │           <div className="space-y-2">
 106 │             <p className="text-sm font-medium text-neutral-800">IT representative signature</p>
 107 │             <div className="h-12 border-b border-neutral-300" />
 108 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 109 │           </div>
 110 │         </div>
 111 │       </div>
 112 │ 
 113 │       <div className="print:hidden">
 114 │         <AiWorkspace workspaceId={params.workspaceId} assetId={params.assetId} />
 115 │       </div>
 116 │ 
 117 │       <div className="fixed bottom-4 right-4 flex items-center gap-3 print:hidden">
 118 │         <Link
 119 │           href="#"
 120 │           onClick={(e) => {
 121 │             e.preventDefault();
 122 │             if (typeof window !== "undefined") window.print();
 123 │           }}
 124 │           className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
 125 │         >
 126 │           Download PDF
 127 │         </Link>
 128 │         <Link
 129 │           href={`/w/${params.workspaceId}/assets/${params.assetId}`}
 130 │           className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
 131 │         >
 132 │           Back to asset
 133 │         </Link>
 134 │       </div>
 135 │     </div>
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
 139 │  "use client";
 140 │ 
 141 │ import Link from "next/link";
 142 │ import { format } from "date-fns";
 143 │ import { AiWorkspace } from "@/components/ai-workspace";
 144 │ import { getAsset } from "@/lib/assets";
 145 │ import { prisma } from "@/lib/prisma";
 146 │ import { getCurrentSession } from "@/lib/auth";
 147 │ import { effectiveRole } from "@/lib/rbac";
     ·          ──────┬──────
     ·                ╰── `effectiveRole` redefined here
 148 │ import { redirect } from "next/navigation";
     ╰────

  × the name `redirect` is defined multiple times
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:1:1]
   1 │ import { redirect } from "next/navigation";
     ·          ────┬───
     ·              ╰── previous definition of `redirect` here
   2 │ import { format } from "date-fns";
   3 │ import { AiWorkspace } from "@/components/ai-workspace";
   4 │ import { getCurrentSession } from "@/lib/auth";
   5 │ import { getAsset } from "@/lib/assets";
   6 │ import { prisma } from "@/lib/prisma";
   7 │ import { effectiveRole } from "@/lib/rbac";
   8 │ 
   9 │ function formatDate(value?: Date | null) {
  10 │   return value ? format(value, "yyyy-MM-dd") : "-";
  11 │ }
  12 │ 
  13 │ export default async function AssetHandoffPage({ params }: { params: { workspaceId: string; assetId: string } }) {
  14 │   const session = await getCurrentSession();
  15 │   if (!session?.user?.id) redirect("/login");
  16 │ 
  17 │   const membership = await prisma.workspaceMember.findUnique({
  18 │     where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  19 │     include: { workspace: true },
  20 │   });
  21 │   if (!membership) redirect("/login");
  22 │ 
  23 │   const role = effectiveRole(session.user.role, membership.role);
  24 │   const asset = await getAsset(params.workspaceId, params.assetId);
  25 │   if (!asset) redirect(`/w/${params.workspaceId}/assets`);
  26 │ 
  27 │   const assignee = asset.assignedTo;
  28 │ 
  29 │   const deviceName = asset.assetTag ?? asset.model ?? asset.category ?? "Device";
  30 │   const deviceModel = asset.model ?? "-";
  31 │   const serial = asset.serialNumber ?? "-";
  32 │   const accessories = (asset as any).accessories ?? "-";
  33 │ 
  34 │   return (
  35 │     <div className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0">
  36 │       <div className="flex items-start justify-between gap-4">
  37 │         <div>
  38 │           <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">IT Asset Acceptance Form</p>
  39 │           <h1 className="text-2xl font-semibold text-neutral-900">Asset handoff</h1>
  40 │           <p className="text-sm text-neutral-600">Workspace: {membership.workspace.name}</p>
  41 │         </div>
  42 │         <div className="space-y-2 text-right">
  43 │           <p className="text-xs text-neutral-500">Generated: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
  44 │         </div>
  45 │       </div>
  46 │ 
  47 │       <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  48 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  49 │           <h2 className="text-sm font-semibold text-neutral-900">Employee Information</h2>
  50 │           <div className="space-y-1 text-sm text-neutral-700">
  51 │             <p>
  52 │               <span className="font-medium">Full Name:</span> {assignee?.name ?? "Unassigned"}
  53 │             </p>
  54 │             <p>
  55 │               <span className="font-medium">Email:</span> {assignee?.email ?? "—"}
  56 │             </p>
  57 │             <p>
  58 │               <span className="font-medium">Dept / Title:</span> {assignee?.title ?? "—"}
  59 │             </p>
  60 │             <p>
  61 │               <span className="font-medium">Start date:</span> —
  62 │             </p>
  63 │           </div>
  64 │         </div>
  65 │ 
  66 │         <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  67 │           <h2 className="text-sm font-semibold text-neutral-900">Device Detail</h2>
  68 │           <div className="space-y-1 text-sm text-neutral-700">
  69 │             <p>
  70 │               <span className="font-medium">Device name:</span> {deviceName}
  71 │             </p>
  72 │             <p>
  73 │               <span className="font-medium">Device model:</span> {deviceModel}
  74 │             </p>
  75 │             <p>
  76 │               <span className="font-medium">Serial number:</span> {serial}
  77 │             </p>
  78 │             <p>
  79 │               <span className="font-medium">Accessories:</span> {accessories}
  80 │             </p>
  81 │             <p>
  82 │               <span className="font-medium">Purchase date:</span> {formatDate(asset.purchaseDate)}
  83 │             </p>
  84 │             <p>
  85 │               <span className="font-medium">Warranty end:</span> {formatDate(asset.warrantyEnd)}
  86 │             </p>
  87 │           </div>
  88 │         </div>
  89 │       </div>
  90 │ 
  91 │       <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
  92 │         <h2 className="text-sm font-semibold text-neutral-900">Acknowledgment</h2>
  93 │         <p className="text-sm leading-relaxed text-neutral-700">
  94 │           I acknowledge receipt of the above IT assets and confirm that they are in good working condition unless stated
  95 │           otherwise. I understand my responsibilities for safekeeping and proper use of these assets in accordance with
  96 │           company policies. In the event of asset loss, I will immediately report to the IT team to prevent unauthorized
  97 │           access.
  98 │         </p>
  99 │         <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
 100 │           <div className="space-y-2">
 101 │             <p className="text-sm font-medium text-neutral-800">User signature</p>
 102 │             <div className="h-12 border-b border-neutral-300" />
 103 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 104 │           </div>
 105 │           <div className="space-y-2">
 106 │             <p className="text-sm font-medium text-neutral-800">IT representative signature</p>
 107 │             <div className="h-12 border-b border-neutral-300" />
 108 │             <p className="text-xs text-neutral-600">Date: _____________</p>
 109 │           </div>
 110 │         </div>
 111 │       </div>
 112 │ 
 113 │       <div className="print:hidden">
 114 │         <AiWorkspace workspaceId={params.workspaceId} assetId={params.assetId} />
 115 │       </div>
 116 │ 
 117 │       <div className="fixed bottom-4 right-4 flex items-center gap-3 print:hidden">
 118 │         <Link
 119 │           href="#"
 120 │           onClick={(e) => {
 121 │             e.preventDefault();
 122 │             if (typeof window !== "undefined") window.print();
 123 │           }}
 124 │           className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
 125 │         >
 126 │           Download PDF
 127 │         </Link>
 128 │         <Link
 129 │           href={`/w/${params.workspaceId}/assets/${params.assetId}`}
 130 │           className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
 131 │         >
 132 │           Back to asset
 133 │         </Link>
 134 │       </div>
 135 │     </div>
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
 139 │  "use client";
 140 │ 
 141 │ import Link from "next/link";
 142 │ import { format } from "date-fns";
 143 │ import { AiWorkspace } from "@/components/ai-workspace";
 144 │ import { getAsset } from "@/lib/assets";
 145 │ import { prisma } from "@/lib/prisma";
 146 │ import { getCurrentSession } from "@/lib/auth";
 147 │ import { effectiveRole } from "@/lib/rbac";
 148 │ import { redirect } from "next/navigation";
     ·          ────┬───
     ·              ╰── `redirect` redefined here
     ╰────

  × The "use client" directive must be placed before other expressions. Move it to the top of the file to resolve this issue.
     ╭─[C:\Users\user\Desktop\Project\AssetSpace AI\app\w\[workspaceId]\assets\[assetId]\handoff\page.tsx:136:1]
 136 │   );
 137 │ }
 138 │ import Link from "next/link";
 139 │  "use client";
     ·  ─────────────
 140 │ 
 141 │ import Link from "next/link";
 142 │ import { format } from "date-fns";
}

function stripTargetStatusPhrase(text: string, status: AssetStatus) {
  const keywords = statusKeywords[status];
  const keywordPattern = keywords.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|");
  return text.replace(new RegExp(`\\b(?:to|as|status)\\s+(?:${keywordPattern})\\b`, "gi"), " ");
}

function stripCommandWords(text: string) {
  const verbPattern = updateVerbs.map(escapeRegExp).join("|");
  const fillerPattern = fillerWords.map(escapeRegExp).join("|");
  return text
    .replace(new RegExp(`\\b(?:${verbPattern})\\b`, "gi"), " ")
    .replace(new RegExp(`\\b(?:${fillerPattern})\\b`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripFilterWords(text: string) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const kept: string[] = [];

  for (const token of tokens) {
    const trimmed = token.replace(/^[^a-z0-9_-]+|[^a-z0-9_-]+$/g, "");
    if (!trimmed) continue;
    if (filterStopWords.has(trimmed)) continue;
    kept.push(trimmed);
  }

  return kept.join(" ").trim();
}

function extractCount(text: string) {
  const unitPattern = unitWords.map(escapeRegExp).join("|");
  const unitMatch = text.match(new RegExp(`\\b(\\d+)\\s*(?:${unitPattern})\\b`, "i"));
  if (unitMatch?.[1]) return Number(unitMatch[1]);

  const verbPattern = createVerbs.map(escapeRegExp).join("|");
  const verbMatch = text.match(new RegExp(`\\b(?:${verbPattern})\\b\\s+(\\d+)\\b`, "i"));
  if (verbMatch?.[1]) return Number(verbMatch[1]);

  return null;
}

function extractTagSample(text: string) {
  const formatMatch = text.match(/\bformat(?: like)?\s+([a-z0-9_-]+)\b/i);
  if (formatMatch?.[1]) return formatMatch[1];

  const tagMatch = text.match(/\b(?:asset\s+tag|tag)\s+([a-z0-9_-]+)\b/i);
  if (tagMatch?.[1]) return tagMatch[1];

  const likeMatch = text.match(/\blike\s+([a-z0-9_-]*\d+[a-z0-9_-]*)\b/i);
  if (likeMatch?.[1] && /\d/.test(likeMatch[1])) return likeMatch[1];

  const tokenMatch = text.match(/\b([a-z]+[a-z0-9_-]*\d+)\b/i);
  if (tokenMatch?.[1]) return tokenMatch[1];

  return null;
}

function extractTagRange(text: string) {
  const tagToken = "[a-z]+[a-z0-9_-]*\\d+";
  const patterns = [
    new RegExp(`\\b(?:from\\s+)?(${tagToken})\\s+(?:to|until|through|thru)\\s+(${tagToken})\\b`, "i"),
    new RegExp(`\\bbetween\\s+(${tagToken})\\s+and\\s+(${tagToken})\\b`, "i"),
    new RegExp(`\\b(${tagToken})\\s*-\\s*(${tagToken})\\b`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match?.[2]) {
      return { startTag: match[1], endTag: match[2], matchText: match[0] };
    }
  }

  return null;
}

function parseTagPattern(sample: string) {
  const match = sample.match(/^(.*?)(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  const number = match[2];
  if (!prefix) return null;
  return {
    prefix,
    start: Number(number),
    width: number.length,
  };
}

function parseTagRange(range: { startTag: string; endTag: string }) {
  const startPattern = parseTagPattern(range.startTag);
  const endPattern = parseTagPattern(range.endTag);
  if (!startPattern || !endPattern) return null;
  if (startPattern.prefix.toLowerCase() !== endPattern.prefix.toLowerCase() || startPattern.width !== endPattern.width) {
    return null;
  }
  const count = endPattern.start - startPattern.start + 1;
  if (!Number.isFinite(count) || count <= 0) return null;
  return {
    prefix: startPattern.prefix,
    start: startPattern.start,
    width: startPattern.width,
    count,
  };
}

function buildTagsFromRange(range: { prefix: string; start: number; width: number; count: number }) {
  return Array.from({ length: range.count }, (_, index) =>
    `${range.prefix}${String(range.start + index).padStart(range.width, "0")}`,
  );
}

function normalizeCategoryCandidate(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return undefined;
  const tokens = cleaned.split(" ").filter(Boolean);
  if (!tokens.length) return undefined;

  const stopWords = new Set([
    ...updateVerbs,
    ...createVerbs,
    "from",
    "until",
    "through",
    "thru",
    "between",
    "range",
    "to",
    "and",
    "all",
    "the",
    "a",
    "an",
    "category",
    "categories",
    "for",
  ]);
  while (tokens.length && stopWords.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (!tokens.length) return undefined;
  if (stopWords.has(tokens[0])) return undefined;
  if (tokens.some((token) => looksLikeAssetTag(token))) return undefined;
  return tokens.join(" ");
}

function extractCategoryMatch(text: string) {
  const patterns = [
    /\bcategory\s*(?:is|=|:|to)?\s+([a-z0-9_-]+(?:\s+[a-z0-9_-]+){0,2})\b/i,
    /\bto\s+category\s+([a-z0-9_-]+(?:\s+[a-z0-9_-]+){0,2})\b/i,
    /\bto\s+([a-z0-9_-]+(?:\s+[a-z0-9_-]+){0,2})\s+category\b/i,
    /\b([a-z0-9_-]+(?:\s+[a-z0-9_-]+){0,2})\s+category\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const candidate = normalizeCategoryCandidate(match[1]);
      if (candidate) return { value: candidate, matchText: match[0] };
    }
  }

  return null;
}

function extractCategoryByKeyword(text: string) {
  return extractCategoryMatch(text)?.value;
}

function extractAssigneeMatch(text: string) {
  const match = text.match(/\b(?:assign|reassign)\b.*?\bto\s+([a-z][a-z0-9\s.'-]{1,80})/i);
  if (match?.[1]) {
    const value = match[1].replace(/[^a-z0-9\s.'-]+/gi, " ").replace(/\s+/g, " ").trim();
    if (value) {
      return { value, matchText: match[0] };
    }
  }
  return null;
}

function extractCategory(text: string) {
  const normalized = text.toLowerCase();
  const explicitCategory = extractCategoryByKeyword(normalized);
  if (explicitCategory) return explicitCategory;

  const tokens = normalized.replace(/[^a-z0-9_-]+/g, " ").split(/\s+/).filter(Boolean);
  const verbIndex = tokens.findIndex((token) => createVerbs.includes(token));
  if (verbIndex === -1) return undefined;

  const stopWords = new Set([
    ...unitWords,
    "all",
    "category",
    "categories",
    "format",
    "tag",
    "name",
    "like",
    "using",
    "use",
    "with",
    "and",
    "to",
    "for",
    "of",
    "the",
    "a",
    "an",
    "asset",
    "assets",
    "from",
    "until",
    "through",
    "thru",
    "between",
    "range",
  ]);

  const categoryTokens: string[] = [];
  for (let i = verbIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (/^\d+$/.test(token)) {
      if (categoryTokens.length) break;
      continue;
    }

    if (looksLikeAssetTag(token)) {
      if (categoryTokens.length) break;
      continue;
    }

    if (stopWords.has(token)) {
      if (categoryTokens.length) break;
      continue;
    }

    categoryTokens.push(token);
    if (categoryTokens.length >= 3) break;
  }

  return categoryTokens.length ? categoryTokens.join(" ") : undefined;
}

function extractLocationMatch(text: string) {
  const match = text.match(/\blocation\b\s*(?:to|in|at|is)?\s*([a-z][a-z0-9\s.'-]{1,80})/i);
  if (match?.[1]) {
    const value = match[1].replace(/[^a-z0-9\s.'-]+/gi, " ").replace(/\s+/g, " ").trim();
    if (value) {
      return { value, matchText: match[0] };
    }
  }
  return null;
}

export function deriveFiltersFromText(text: string): FilterSpec {
  const normalized = text.toLowerCase();
  const statuses: AssetStatus[] = [];

  for (const [status, keywords] of Object.entries(statusKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      statuses.push(status as AssetStatus);
    }
  }

  const locationMatch = normalized.match(/in ([a-z0-9\s]+) office/);

  const spec: FilterSpec = {};
  if (statuses.length) spec.statuses = Array.from(new Set(statuses));
  if (locationMatch) spec.location = locationMatch[1].trim();

  const cleaned = normalized
    .replace(createStatusRegex("g"), "")
    .replace(/in [a-z0-9\s]+ office/g, "")
    .trim();
  const search = stripFilterWords(cleaned);
  if (search) spec.search = search;

  return spec;
}

export function filterSpecToAssetFilterInput(spec: FilterSpec): AssetFilterInput {
  const sortMap: Record<SortBy, AssetFilterInput["sort"]> = {
    [SortBy.UPDATED]: "updatedAt",
    [SortBy.CREATED]: "createdAt",
    [SortBy.WARRANTY_END]: "warrantyEnd",
    [SortBy.PURCHASE_DATE]: "purchaseDate",
  };
  const statusList = spec.statuses as unknown as AssetStatus[] | undefined;

  return {
    q: spec.search,
    assetTags: spec.assetTags,
    status: statusList,
    category: spec.category,
    location: spec.location,
    assignedTo: spec.assignedTo,
    purchasedWithinDays: spec.purchasedWithinDays,
    warrantyExpiringInDays: spec.warrantyExpiringInDays,
    sort: spec.sortBy ? sortMap[spec.sortBy] : undefined,
    direction: spec.direction ? (spec.direction === "ASC" ? "asc" : "desc") : undefined,
    limit: spec.limit,
  };
}

export type CreateSpec = {
  count: number;
  tagPrefix: string;
  tagStart: number;
  tagWidth: number;
  category?: string;
  status?: AssetStatus;
};

export type AssistantIntent =
  | { intent: "filter"; spec: FilterSpec }
  | { intent: "update"; spec: FilterSpec; update: { status?: AssetStatus; category?: string; assignedTo?: string } }
  | { intent: "create"; create: CreateSpec }
  | { intent: "delete"; spec: FilterSpec }
  | { intent: "unknown"; message: string };

export function deriveAssistantAction(text: string): AssistantIntent {
  const normalized = text.toLowerCase();
  if (hasCreateVerb(normalized)) {
    const tagRange = extractTagRange(normalized);
    const categorySource = tagRange ? normalized.replace(tagRange.matchText, " ") : normalized;

    if (tagRange) {
      const parsedRange = parseTagRange(tagRange);
      if (!parsedRange) {
        return {
          intent: "unknown",
          message: "Tag ranges must use the same prefix and number width, like \"MYIPAD0307 to MYIPAD0374\".",
        };
      }

      const statusMatches = findStatusMatches(normalized);
      const status = statusMatches.length === 1 ? statusMatches[0] : undefined;
      const category = extractCategory(categorySource);

      return {
        intent: "create",
        create: {
          count: parsedRange.count,
          tagPrefix: parsedRange.prefix,
          tagStart: parsedRange.start,
          tagWidth: parsedRange.width,
          category,
          status,
        },
      };
    }

    const tagSample = extractTagSample(normalized);
    if (!tagSample) {
      return {
        intent: "unknown",
        message: "Please include an asset tag format like \"MYPC001\".",
      };
    }

    const tagPattern = parseTagPattern(tagSample);
    if (!tagPattern) {
      return {
        intent: "unknown",
        message: "Asset tag formats must end with a number, like \"MYPC001\".",
      };
    }

    const count = extractCount(normalized) ?? 1;
    if (!Number.isFinite(count) || count <= 0) {
      return {
        intent: "unknown",
        message: "Please include how many assets to add.",
      };
    }

    const statusMatches = findStatusMatches(normalized);
    const status = statusMatches.length === 1 ? statusMatches[0] : undefined;
    const category = extractCategory(categorySource);

    return {
      intent: "create",
      create: {
        count,
        tagPrefix: tagPattern.prefix,
        tagStart: tagPattern.start,
        tagWidth: tagPattern.width,
        category,
        status,
      },
    };
  }

  const targetStatus = extractTargetStatus(normalized);
  const tagRangeNormalized = extractTagRange(normalized);
  const categorySource = tagRangeNormalized ? normalized.replace(tagRangeNormalized.matchText, " ") : normalized;
  const categoryMatch = extractCategoryMatch(categorySource);
  const targetCategory = categoryMatch?.value;
  const assigneeMatch = extractAssigneeMatch(normalized);
  const targetAssignee = assigneeMatch?.value;
  const hasVerb = hasUpdateVerb(normalized) || hasAssignVerb(normalized);

  if (hasDeleteVerb(normalized)) {
    const tagRangeRaw = extractTagRange(text);
    const parsedRange = tagRangeRaw ? parseTagRange(tagRangeRaw) : tagRangeNormalized ? parseTagRange(tagRangeNormalized) : null;
    if ((tagRangeRaw || tagRangeNormalized) && !parsedRange) {
      return {
        intent: "unknown",
        message: "Tag ranges must use the same prefix and number width, like \"MYIPAD0307 to MYIPAD0374\".",
      };
    }

    let cleaned = normalized;
    cleaned = cleaned.replace(new RegExp(`\\b(?:${deleteVerbs.map(escapeRegExp).join("|")})\\b`, "gi"), " ");
    if (tagRangeNormalized?.matchText) cleaned = cleaned.replace(tagRangeNormalized.matchText, " ");
    cleaned = stripCommandWords(cleaned);

    const spec = deriveFiltersFromText(cleaned);
    if (parsedRange) {
      spec.assetTags = buildTagsFromRange(parsedRange);
      delete spec.search;
    }
    if (!spec.category && spec.search) {
      const trimmed = spec.search.trim();
      if (trimmed && !trimmed.includes(" ")) {
        spec.category = trimmed;
        delete spec.search;
      }
    }

    return { intent: "delete", spec };
  }

  if (hasVerb && (targetStatus || targetCategory || targetAssignee)) {
    const tagRangeRaw = extractTagRange(text);
    const parsedRange = tagRangeRaw ? parseTagRange(tagRangeRaw) : tagRangeNormalized ? parseTagRange(tagRangeNormalized) : null;
    if ((tagRangeRaw || tagRangeNormalized) && !parsedRange) {
      return {
        intent: "unknown",
        message: "Tag ranges must use the same prefix and number width, like \"MYIPAD0307 to MYIPAD0374\".",
      };
    }

    let cleaned = normalized;
    if (targetStatus) cleaned = stripTargetStatusPhrase(cleaned, targetStatus);
    if (categoryMatch?.matchText) cleaned = cleaned.replace(categoryMatch.matchText, " ");
    if (targetAssignee) {
      cleaned = cleaned.replace(new RegExp(`\\b${escapeRegExp(targetAssignee)}\\b`, "gi"), " ");
    }
    if (tagRangeNormalized?.matchText) cleaned = cleaned.replace(tagRangeNormalized.matchText, " ");
    cleaned = stripCommandWords(cleaned);

    const spec = deriveFiltersFromText(cleaned);
    if (parsedRange) {
      spec.assetTags = buildTagsFromRange(parsedRange);
      delete spec.search;
    }

    return {
      intent: "update",
      spec,
      update: {
        ...(targetStatus ? { status: targetStatus } : {}),
        ...(targetCategory ? { category: targetCategory } : {}),
        ...(targetAssignee ? { assignedTo: targetAssignee } : {}),
      },
    };
  }

  if (hasVerb) {
    return {
      intent: "unknown",
      message:
        "I can update status, category, or assignee with requests like \"change all ipads to assigned\", \"set category to ipad for MYIPAD0307-MYIPAD0374\", or \"assign ipads to Jane Doe\".",
    };
  }

  return { intent: "filter", spec: deriveFiltersFromText(normalized) };
}

export function summarizeAssetContent(notes: string | null | undefined, activity: { action: string; createdAt: Date }[]) {
  const recent = activity
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
    .map((item) => `${item.action} (${item.createdAt.toDateString()})`)
    .join("; ");

  if (!process.env.AI_API_KEY) {
    return `Summary (offline): ${notes?.slice(0, 140) ?? "No notes yet"}. Recent: ${recent || "no activity logged"}.`;
  }

  // Placeholder until a model call is wired up.
  return `Summary: ${notes?.slice(0, 200) ?? "No notes yet."} Recent events: ${recent || "none recorded"}.`;
}
