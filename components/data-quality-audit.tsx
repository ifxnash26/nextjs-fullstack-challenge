"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AuditIssue } from "@/server/audit/dataQuality";
import { Status as FilterStatus } from "@/server/ai/filterSpec";

type AuditReport = {
  issues: AuditIssue[];
  generatedAt: string;
};

function label(type: AuditIssue["type"]) {
  const map: Record<AuditIssue["type"], string> = {
    MISSING_SERIAL: "Missing serial numbers",
    MISSING_ASSET_TAG: "Missing asset tags",
    MISSING_CATEGORY: "Missing category",
    MISSING_BRAND: "Missing brand",
    MISSING_MODEL: "Missing model",
    MISSING_LOCATION: "Missing location",
    MISSING_PURCHASE_DATE: "Missing purchase date",
    MISSING_WARRANTY_END: "Missing warranty end date",
    WARRANTY_BEFORE_PURCHASE: "Warranty end before purchase date",
    DUPLICATE_SERIAL: "Duplicate serial numbers",
    DUPLICATE_ASSET_TAG: "Duplicate asset tags",
    ASSIGNED_WITHOUT_ASSIGNEE: "Assigned assets without assignee",
    MISSING_IMEI: "Missing IMEI",
    MISSING_DEVICE_SPEC: "Missing device spec",
    MISSING_ACCESSORIES: "Missing accessories",
  };
  return map[type] ?? type;
}

function buildFilters(searchParams: ReturnType<typeof useSearchParams>) {
  const statuses = searchParams
    .getAll("status")
    .flatMap((value) => value.split(","))
    .map((value) => value.toUpperCase())
    .filter((value) => Object.values(FilterStatus).includes(value as FilterStatus));

  const getString = (key: string) => {
    const value = searchParams.get(key);
    return typeof value === "string" && value.trim() ? value : undefined;
  };

  const asNumber = (key: string) => {
    const value = searchParams.get(key);
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    q: getString("q"),
    category: getString("category"),
    location: getString("location"),
    assignedTo: getString("assignedTo"),
    status: statuses.length ? (statuses as FilterStatus[]) : undefined,
    warrantyExpiringInDays: asNumber("warrantyExpiringInDays"),
    purchasedWithinDays: asNumber("purchasedWithinDays"),
  };
}

function issueLink(workspaceId: string, issue: AuditIssue) {
  const firstExample = issue.examples[0];

  if (issue.examples.length === 1 && firstExample?.assetId) {
    return `/w/${workspaceId}/assets/${firstExample.assetId}`;
  }

  const tags = issue.examples.map((ex) => ex.assetTag).filter(Boolean) as string[];
  if (tags.length) {
    return `/w/${workspaceId}/assets?assetTags=${encodeURIComponent(tags.join(","))}`;
  }

  if (issue.type === "ASSIGNED_WITHOUT_ASSIGNEE") {
    return `/w/${workspaceId}/assets?status=${FilterStatus.ASSIGNED}`;
  }
  if (tags.length > 1) {
    const prefix = tags.reduce((acc, tag) => {
      if (!acc) return tag;
      let i = 0;
      while (i < acc.length && i < tag.length && acc[i] === tag[i]) i += 1;
      return acc.slice(0, i);
    }, tags[0]);

    if (prefix && prefix.length >= 3) {
      return `/w/${workspaceId}/assets?q=${encodeURIComponent(prefix)}`;
    }
  }

  if (firstExample?.assetTag) {
    return `/w/${workspaceId}/assets?q=${encodeURIComponent(firstExample.assetTag)}`;
  }

  return `/w/${workspaceId}/assets`;
}

export function DataQualityAudit({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [actions, setActions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => buildFilters(searchParams), [searchParams]);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    setActions(null);
    try {
      const res = await fetch("/api/audit/data-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, filters }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to run audit.");
      }
      const payload = (await res.json()) as AuditReport;
      setReport(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run audit.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const explain = async () => {
    if (!report) return;
    setExplainLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/explain-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, issues: report.issues }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to explain report.");
      }
      const payload = (await res.json()) as { actions: string[] };
      setActions(payload.actions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to explain report.");
      setActions(null);
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Data quality audit</p>
          <p className="text-xs text-muted-foreground">Checks are scoped to current filters.</p>
        </div>
        <Button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="rounded-full px-4"
          variant="secondary"
          size="sm"
        >
          {loading ? "Checking..." : "Run audit"}
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {report ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{report.generatedAt ? `Generated ${formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })}` : ""}</span>
            {report.issues.length ? (
              <Button type="button" size="sm" variant="ghost" className="rounded-full px-3" onClick={explain} disabled={explainLoading}>
                {explainLoading ? "Explaining..." : "Explain"}
              </Button>
            ) : null}
          </div>
          {report.issues.length === 0 ? (
            <Alert variant="success">No data quality issues found for this view.</Alert>
          ) : (
            <div className="space-y-2">
              {report.issues.map((issue) => (
                <div
                  key={issue.type}
                  className="rounded-md border border-border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {label(issue.type)} — {issue.count}
                      </p>
                      <p className="text-xs text-muted-foreground">{issue.suggestion}</p>
                      {issue.examples?.length ? (
                        <p className="text-xs text-muted-foreground">
                          Examples:{" "}
                          {issue.examples
                            .slice(0, 5)
                            .map((ex) => ex.assetTag || ex.assetId)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={issueLink(workspaceId, issue)}
                      className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {actions?.length ? (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-1 font-semibold">Suggested actions</p>
              <ul className="list-disc space-y-1 pl-5">
                {actions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

