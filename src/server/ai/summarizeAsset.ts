import { AssetStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess } from "@/lib/workspaces";

export type SummaryContext = {
  asset: {
    id: string;
    assetTag: string;
    category: string | null;
    status: AssetStatus;
    assignee: string | null;
    location: string | null;
    purchaseDate: Date | null;
    warrantyEnd: Date | null;
    updatedAt: Date;
    serialNumber?: string | null;
  };
  activities: { action: string; createdAt: Date; changes?: Record<string, unknown> | null }[];
  notes: string | null;
};

export type SummarizeResult = {
  summaryBullets: string[];
  highlights: {
    status?: string;
    assignee?: string;
    location?: string;
    warrantyStatus?: string;
  };
  riskFlags: string[];
  generatedAt: string;
};

const noteLimit = 3000;

function removeSecrets(text: string) {
  let cleaned = text.replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*([a-z0-9]{12,})/gi, "$1: [redacted]");
  cleaned = cleaned.replace(/[A-Za-z0-9+\/=]{32,}/g, "[redacted]");
  return cleaned.slice(0, noteLimit);
}

export async function getAssetSummaryContext(workspaceId: string, assetId: string, userId: string): Promise<SummaryContext> {
  await requireWorkspaceAccess(userId, workspaceId);

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId },
    select: {
      id: true,
      assetTag: true,
      category: true,
      status: true,
      location: true,
      purchaseDate: true,
      warrantyEnd: true,
      updatedAt: true,
      notes: true,
      serialNumber: true,
      assignedTo: { select: { name: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          action: true,
          createdAt: true,
          changes: true,
        },
      },
    },
  });

  if (!asset) {
    throw new Error("Asset not found");
  }

  const sanitizedNotes = asset.notes ? removeSecrets(asset.notes) : null;

  return {
    asset: {
      id: asset.id,
      assetTag: asset.assetTag,
      category: asset.category,
      status: asset.status,
      assignee: asset.assignedTo?.name ?? null,
      location: asset.location,
      purchaseDate: asset.purchaseDate,
      warrantyEnd: asset.warrantyEnd,
      updatedAt: asset.updatedAt,
      serialNumber: asset.serialNumber,
    },
    activities: asset.activities.map((activity) => ({
      action: activity.action,
      createdAt: activity.createdAt,
      changes: typeof activity.changes === "object" && activity.changes !== null ? (activity.changes as Record<string, unknown>) : null,
    })),
    notes: sanitizedNotes,
  };
}

function formatDate(d: Date | null | undefined) {
  return d ? d.toISOString().split("T")[0] : null;
}

function daysUntil(date: Date | null | undefined) {
  if (!date) return null;
  const diff = date.getTime() - Date.now();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function buildWarrantyStatus(warrantyEnd: Date | null | undefined) {
  const days = daysUntil(warrantyEnd);
  if (days === null) return "No warranty date";
  if (days < 0) return `Warranty expired ${Math.abs(days)} days ago`;
  if (days === 0) return "Warranty expires today";
  if (days <= 30) return `Warranty expires in ${days} days`;
  return `Warranty valid (~${days} days left)`;
}

function recentActivities(activities: SummaryContext["activities"]) {
  return activities.slice(0, 3).map((activity) => {
    const date = formatDate(activity.createdAt);
    return date ? `${activity.action} on ${date}` : activity.action;
  });
}

function extractNoteHighlights(notes: string | null) {
  if (!notes) return [];
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, 3);
}

function buildRiskFlags(context: SummaryContext) {
  const flags: string[] = [];
  const warrantyDays = daysUntil(context.asset.warrantyEnd);
  if (warrantyDays !== null) {
    if (warrantyDays < 0) flags.push("Warranty expired");
    else if (warrantyDays <= 30) flags.push("Warranty expiring soon");
  }

  if (context.asset.status === AssetStatus.REPAIR) {
    const updatedDays = daysUntil(context.asset.updatedAt);
    if (typeof updatedDays === "number" && updatedDays < -14) {
      flags.push("In repair > 14 days");
    }
  }

  if (!context.asset.serialNumber) {
    flags.push("Missing serial number");
  }

  return flags;
}

function fallbackSummary(context: SummaryContext): SummarizeResult {
  const bullets: string[] = [];

  const stateParts = [
    `Status: ${context.asset.status}`,
    context.asset.category ? `Category: ${context.asset.category}` : null,
    context.asset.assignee ? `Assigned to: ${context.asset.assignee}` : null,
    context.asset.location ? `Location: ${context.asset.location}` : null,
  ].filter(Boolean);
  bullets.push(stateParts.join(" | "));

  const warrantyStatus = buildWarrantyStatus(context.asset.warrantyEnd);
  bullets.push(warrantyStatus);

  const purchasePart = context.asset.purchaseDate ? `Purchased: ${formatDate(context.asset.purchaseDate)}` : null;
  const updatedPart = `Last updated: ${formatDate(context.asset.updatedAt)}`;
  bullets.push([purchasePart, updatedPart].filter(Boolean).join(" | "));

  const recent = recentActivities(context.activities);
  if (recent.length) {
    bullets.push(`Recent changes: ${recent.join("; ")}`);
  }

  const noteHighlights = extractNoteHighlights(context.notes);
  noteHighlights.forEach((line) => bullets.push(`Note: ${line}`));

  const limited = bullets.filter(Boolean).slice(0, 8);
  const highlights = {
    status: context.asset.status,
    assignee: context.asset.assignee ?? undefined,
    location: context.asset.location ?? undefined,
    warrantyStatus,
  };

  return {
    summaryBullets: limited,
    highlights,
    riskFlags: buildRiskFlags(context),
    generatedAt: new Date().toISOString(),
  };
}

const aiResponseSchema = z.object({
  summaryBullets: z.array(z.string()).min(1).max(8),
  highlights: z
    .object({
      status: z.string().optional(),
      assignee: z.string().optional(),
      location: z.string().optional(),
      warrantyStatus: z.string().optional(),
    })
    .optional(),
  riskFlags: z.array(z.string()).optional(),
});

function getAiConfig() {
  return {
    provider: (process.env.AI_PROVIDER || "").toLowerCase(),
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

async function summarizeWithAi(context: SummaryContext): Promise<SummarizeResult | null> {
  const { provider, apiKey, model } = getAiConfig();
  if (provider !== "openai" || !apiKey) return null;

  const trimmedNotes = context.notes ? context.notes.slice(0, 1200) : "";
  const activityLines = context.activities.map((activity) => `${activity.action} (${formatDate(activity.createdAt)})`).join("; ");

  const prompt = `
You summarize an IT asset for support teams. Respond with JSON only.
Fields: summaryBullets (5-8 short bullets), highlights {status, assignee, location, warrantyStatus}, riskFlags (array).
Rules:
- Keep bullets concise; no markdown tables.
- Include warranty insight and recent changes.
- Do not include raw notes; only distilled insights.
- If data is missing, omit the field.

Asset: ${context.asset.assetTag}
Category: ${context.asset.category ?? "unknown"}
Status: ${context.asset.status}
Assignee: ${context.asset.assignee ?? "unassigned"}
Location: ${context.asset.location ?? "unspecified"}
Purchase date: ${formatDate(context.asset.purchaseDate) ?? "unknown"}
Warranty end: ${formatDate(context.asset.warrantyEnd) ?? "unknown"}
Updated at: ${formatDate(context.asset.updatedAt) ?? "unknown"}
Activities: ${activityLines || "none"}
Notes: ${trimmedNotes || "none"}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.trim() },
        { role: "user", content: "Summarize this asset." },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const validated = aiResponseSchema.safeParse(parsed);
  if (!validated.success) return null;

  return {
    summaryBullets: validated.data.summaryBullets.slice(0, 8),
    highlights: validated.data.highlights ?? {},
    riskFlags: validated.data.riskFlags ?? [],
    generatedAt: new Date().toISOString(),
  };
}

export async function summarizeAsset(context: SummaryContext): Promise<SummarizeResult> {
  const ai = await summarizeWithAi(context).catch(() => null);
  if (ai) return ai;
  return fallbackSummary(context);
}

export { fallbackSummary };
