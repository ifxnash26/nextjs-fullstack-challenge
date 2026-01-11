"use client";

import Link from "next/link";

type Props = {
  workspaceId: string;
  assetId: string;
};

export function PrintControls({ workspaceId, assetId }: Props) {
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-3 print:hidden">
      <a
        href={`/api/assets/${assetId}/handoff`}
        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
      >
        Download PDF
      </a>
      <Link
        href={`/w/${workspaceId}/assets/${assetId}`}
        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
      >
        Back to asset
      </Link>
    </div>
  );
}
