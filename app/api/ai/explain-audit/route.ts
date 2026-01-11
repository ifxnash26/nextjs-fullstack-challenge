import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getWorkspaceMembership } from "@/lib/workspaces";

const issueSchema = z.object({
  type: z.string(),
  count: z.number(),
  suggestion: z.string(),
  examples: z
    .array(
      z.object({
        assetId: z.string(),
        assetTag: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

const requestSchema = z.object({
  workspaceId: z.string(),
  issues: z.array(issueSchema),
});

function getAiConfig() {
  return {
    provider: (process.env.AI_PROVIDER || "").toLowerCase(),
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

function labelIssue(type: string) {
  const map: Record<string, string> = {
    MISSING_SERIAL: "Missing serial numbers",
    MISSING_ASSET_TAG: "Missing asset tags",
    WARRANTY_BEFORE_PURCHASE: "Warranty end before purchase date",
    DUPLICATE_SERIAL: "Duplicate serial numbers",
    DUPLICATE_ASSET_TAG: "Duplicate asset tags",
    ASSIGNED_WITHOUT_ASSIGNEE: "Assigned assets without assignee",
  };
  return map[type] ?? type;
}

async function explainWithAi(issues: z.infer<typeof issueSchema>[]) {
  const { provider, apiKey, model } = getAiConfig();
  if (provider !== "openai" || !apiKey) return null;

  const condensed = issues
    .map(
      (issue) =>
        `${labelIssue(issue.type)}: count ${issue.count}; suggestion: ${issue.suggestion}; examples: ${(issue.examples || [])
          .map((ex) => ex.assetTag || ex.assetId)
          .join(", ")}`,
    )
    .join("\n");

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
        {
          role: "system",
          content:
            "You turn an inventory data-quality report into a short list of actions. Reply with JSON: { actions: string[] } with 3-6 concise bullet actions. Do not invent data.",
        },
        { role: "user", content: condensed },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    const actions = Array.isArray(parsed.actions) ? parsed.actions.map(String).slice(0, 6) : null;
    if (actions && actions.length) {
      return actions;
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { workspaceId, issues } = parsed.data;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const aiActions = await explainWithAi(issues).catch(() => null);
  if (aiActions?.length) {
    return NextResponse.json({ actions: aiActions });
  }

  const fallbackActions = issues.slice(0, 6).map((issue) => {
    return `${labelIssue(issue.type)}: ${issue.suggestion} (affects ${issue.count} assets)`;
  });

  return NextResponse.json({ actions: fallbackActions });
}
