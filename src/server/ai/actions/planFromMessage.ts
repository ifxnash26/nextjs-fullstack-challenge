import { z } from "zod";
import { ActionPlan, ActionType, planSchema } from "./schemas";
import { normalizeFilterSpec } from "@/server/ai/filterSpec";
import { AssetStatus } from "@prisma/client";

type PlanInput = {
  message: string;
  workspaceId: string;
  userId: string;
  currentFilter?: unknown;
};

const aiResponseSchema = planSchema.extend({
  assistantReply: z.string().optional(),
});

const statusKeywords: Record<string, AssetStatus> = {
  "in stock": AssetStatus.IN_STOCK,
  instock: AssetStatus.IN_STOCK,
  stock: AssetStatus.IN_STOCK,
  assigned: AssetStatus.ASSIGNED,
  assign: AssetStatus.ASSIGNED,
  "in use": AssetStatus.ASSIGNED,
  "in-use": AssetStatus.ASSIGNED,
  "in_use": AssetStatus.ASSIGNED,
  "in used": AssetStatus.ASSIGNED,
  repair: AssetStatus.REPAIR,
  fixing: AssetStatus.REPAIR,
  retired: AssetStatus.RETIRED,
};

function detectStatus(text: string) {
  for (const [key, status] of Object.entries(statusKeywords)) {
    if (text.includes(key)) return status;
  }
  return undefined;
}

function detectAssetTags(text: string) {
  const matches = Array.from(text.matchAll(/\b([A-Z0-9][A-Z0-9_-]{2,})\b/gi))
    .map((match) => match[1])
    .filter((token) => /[A-Z]/i.test(token) && /\d/.test(token))
    .map((token) => token.toUpperCase());
  return Array.from(new Set(matches));
}

const categoryKeywords = ["laptop", "laptops", "ipad", "ipads", "phone", "phones", "monitor", "monitors"];

function detectCategory(text: string) {
  for (const keyword of categoryKeywords) {
    if (text.includes(keyword)) {
      return keyword.endsWith("s") ? keyword.slice(0, -1) : keyword;
    }
  }
  return undefined;
}

function detectAssigneeName(message: string) {
  const stopWords = new Set([
    "assets",
    "asset",
    "devices",
    "device",
    "monitors",
    "monitor",
    "laptops",
    "laptop",
    "ipads",
    "ipad",
    "status",
    "location",
    "office",
    "hq",
    "stock",
    "repair",
    "retired",
    "assigned",
    "unassigned",
    "brand",
    "model",
  ]);

  const match = message.match(/\b(?:assign|reassign)?[^]*?\b(?:to|for)\s+([a-z][a-z\s.'-]{1,60})/i);
  const candidate = match?.[1]?.trim();
  if (!candidate) return undefined;

  const tokens = candidate.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const token of tokens) {
    const cleaned = token.replace(/[^a-z.'-]/gi, "");
    if (!cleaned) continue;
    if (stopWords.has(cleaned.toLowerCase())) break;
    kept.push(cleaned);
    if (kept.length >= 3) break;
  }
  if (!kept.length) return undefined;
  const name = kept.join(" ");
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildSelection(message: string, currentFilter?: unknown, status?: AssetStatus, category?: string) {
  const tags = detectAssetTags(message);
  if (tags.length) {
    return { assetIds: tags };
  }

  const base = currentFilter ? normalizeFilterSpec(currentFilter as any) : {};
  if (status) {
    base.statuses = [status];
  }
  if (category) {
    base.category = category;
  }
  return { filterSpec: normalizeFilterSpec(base) };
}

function heuristicPlan(input: PlanInput): ActionPlan {
  const text = input.message.toLowerCase();
  const assigneeName = detectAssigneeName(input.message);
  const status = detectStatus(text);
  const category = detectCategory(text);
  const baseSelection = buildSelection(text, input.currentFilter, status, category);
  const limitOne = /\b1\b|\bone\b|\bsingle\b|just one/.test(text);
  const actions = [];

  const isAssign = (/\bassign\b/.test(text) || text.includes("assigned assets")) && !text.includes("status");

  if (text.includes("delete") || text.includes("remove")) {
    actions.push({
      type: ActionType.SOFT_DELETE_ASSET,
      selection: baseSelection,
      payload: {},
      reason: "Delete request",
      limitOne,
    });
  } else if (isAssign) {
    const assignSelection = buildSelection(text, input.currentFilter, undefined, category);
    actions.push({
      type: ActionType.ASSIGN_ASSET,
      selection: assignSelection,
      payload: {
        assignedToName: assigneeName,
        status: status ?? AssetStatus.ASSIGNED,
      },
      limitOne,
    });
  } else if (text.includes("move") || text.includes("location")) {
    const locationMatch = text.match(/to ([a-z0-9\s.-]{2,40})/i);
    const location = locationMatch?.[1]?.trim();
    actions.push({
      type: ActionType.CHANGE_LOCATION,
      selection: baseSelection,
      payload: { location },
      limitOne,
    });
  } else if (text.includes("add") || text.includes("create")) {
    actions.push({
      type: ActionType.CREATE_ASSET,
      selection: baseSelection,
      payload: {},
      limitOne,
    });
  } else if (status) {
    actions.push({
      type: ActionType.UPDATE_ASSET,
      selection: baseSelection,
      payload: { status },
      limitOne,
    });
  }

  if (!actions.length) {
    return {
      intent: "MANAGE_ASSETS",
      actions: [],
      requiresConfirmation: false,
      clarifyingQuestion: "What should I do with those assets?",
    };
  }

  return {
    intent: "MANAGE_ASSETS",
    actions,
    requiresConfirmation: actions.some((a) => a.type === ActionType.SOFT_DELETE_ASSET),
  };
}

function getAiConfig() {
  return {
    provider: (process.env.AI_PROVIDER || "").toLowerCase(),
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

async function planWithAi(input: PlanInput) {
  const { provider, apiKey, model } = getAiConfig();
  if (provider !== "openai" || !apiKey) return null;

  const systemPrompt = `
You are an asset inventory planner. Output JSON matching the schema:
{
  "intent": "MANAGE_ASSETS",
  "actions": [
    { "type": "CREATE_ASSET" | "UPDATE_ASSET" | "ASSIGN_ASSET" | "CHANGE_LOCATION" | "BULK_UPDATE" | "SOFT_DELETE_ASSET",
      "selection": { "assetIds": ["AS-123"] } or { "filterSpec": {...} },
      "payload": {
        "status": "IN_STOCK" | "ASSIGNED" | "REPAIR" | "RETIRED",
        "category": string,
        "location": string,
        "assignedToId": string,
        "assignedToName": string,
        "warrantyEnd": date,
        "purchaseDate": date,
        "serialNumber": string,
        "model": string,
        "brand": string,
        "notes": string
      },
      "reason": string
    }
  ],
  "requiresConfirmation": boolean,
  "confirmationText": string,
  "clarifyingQuestion": string
}
Rules: 
- selections must be within workspace ${input.workspaceId}.
- If ambiguous, set clarifyingQuestion.
- Do not invent asset IDs; use filters if unsure.
- Never change assetTag.
Current filter: ${JSON.stringify(input.currentFilter ?? {})}
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
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: input.message },
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
  return validated.data;
}

function applyHints(plan: ActionPlan, message: string): ActionPlan {
  const limitHint = /\b(1|one|single|just one)\b/i.test(message);
  const assigneeHint = detectAssigneeName(message);
  const assetTagHints = detectAssetTags(message);

  return {
    ...plan,
    actions: plan.actions.map((action) => {
      const next = { ...action };
      if (limitHint && next.limitOne === undefined) {
        next.limitOne = true;
      }
      if (
        assigneeHint &&
        next.type === ActionType.ASSIGN_ASSET &&
        !next.payload.assignedToId &&
        !(next.payload as any).assignedToName
      ) {
        next.payload = { ...next.payload, assignedToName: assigneeHint };
      }
      if (
        assetTagHints.length &&
        !(next.selection as any).assetIds &&
        (next.selection as any).filterSpec
      ) {
        next.selection = { assetIds: assetTagHints };
      }
      return next;
    }),
  };
}

export async function planFromMessage(input: PlanInput): Promise<ActionPlan> {
  const aiPlan = await planWithAi(input).catch(() => null);
  if (aiPlan) {
    const hintedAiPlan = applyHints(
      {
        intent: aiPlan.intent,
        actions: aiPlan.actions,
        requiresConfirmation: aiPlan.requiresConfirmation,
        confirmationText: aiPlan.confirmationText,
        clarifyingQuestion: aiPlan.clarifyingQuestion,
      },
      input.message,
    );
    const validatedAi = planSchema.safeParse(hintedAiPlan);
    if (validatedAi.success) {
      return validatedAi.data;
    }
    return {
      intent: aiPlan.intent,
      actions: aiPlan.actions,
      requiresConfirmation: aiPlan.requiresConfirmation,
      confirmationText: aiPlan.confirmationText,
      clarifyingQuestion: aiPlan.clarifyingQuestion,
    };
  }

  const plan = heuristicPlan(input);
  const withHints = applyHints(plan, input.message);
  const validated = planSchema.safeParse(withHints);
  if (validated.success) {
    return validated.data;
  }

  return {
    intent: "MANAGE_ASSETS",
    actions: [],
    requiresConfirmation: false,
    clarifyingQuestion: "I could not understand the request. What action should I take?",
  };
}
