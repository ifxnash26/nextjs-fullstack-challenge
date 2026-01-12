import { z } from "zod";
import { Direction, FilterSpec, SortBy, Status, filterSpecSchema, normalizeFilterSpec } from "./filterSpec";

type BuildFilterSpecInput = {
  message: string;
  workspaceId: string;
  currentFilter?: Partial<FilterSpec>;
};

export type BuildFilterSpecResult = {
  interpretedQuery: string;
  filterSpec?: FilterSpec;
  followUpQuestion?: string;
};

const aiResponseSchema = z.object({
  interpretedQuery: z.string().optional(),
  filterSpec: z.unknown().optional(),
  followUpQuestion: z.string().optional(),
});

const statusKeywords: Record<Status, string[]> = {
  [Status.IN_STOCK]: ["in stock", "available", "inventory"],
  [Status.ASSIGNED]: ["assigned", "in use", "in-use", "in_use", "in used", "checked out", "checked-out", "checkedout"],
  [Status.REPAIR]: ["repair", "in repair", "under repair", "fix", "fixing", "broken"],
  [Status.RETIRED]: ["retired", "decommissioned", "disposed"],
};

const categoryKeywords = [
  "laptop",
  "laptops",
  "ipad",
  "ipads",
  "tablet",
  "tablets",
  "monitor",
  "monitors",
  "phone",
  "phones",
  "desktop",
  "desktops",
  "printer",
  "printers",
  "server",
  "servers",
  "camera",
  "cameras",
];

function getOpenAiConfig() {
  return {
    provider: (process.env.AI_PROVIDER || "").toLowerCase(),
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

function normalizeQueryText(message: string) {
  return message.trim().replace(/\s+/g, " ");
}

function detectStatuses(text: string) {
  const found: Status[] = [];
  for (const [status, keywords] of Object.entries(statusKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        found.push(status as Status);
      }
    }
  return Array.from(new Set(found));
}

function detectCategory(text: string) {
  for (const keyword of categoryKeywords) {
    if (text.includes(keyword)) {
      return keyword.endsWith("s") ? keyword.slice(0, -1) : keyword;
    }
  }
  const match = text.match(/\bcategory[:=]?\s*([a-z0-9][a-z0-9\s-]{1,40})/i);
  return match?.[1]?.trim();
}

function detectAssignedTo(text: string) {
  const match = text.match(/\b(?:assigned|assign)\s+(?:to\s+)?([a-z][a-z0-9\s.'-]{1,60})/i);
  return match?.[1]?.trim();
}

function detectLocation(text: string) {
  const patterns = [
    /\bat\s+([a-z0-9][a-z0-9\s.'-]{1,60})(?:\s+office|\s+site|\s+location)?/i,
    /\bin\s+([a-z0-9][a-z0-9\s.'-]{1,60})(?:\s+office|\s+site|\s+location)?/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      const normalized = value.toLowerCase();
      const inStockCollision =
        normalized === "stock" || normalized === "in stock" || normalized === "instock" || text.includes("in stock");
      if (value && !inStockCollision) {
        return value;
      }
    }
  }
  const officeMatch = text.match(/\b([a-z0-9][a-z0-9\s.'-]{1,60}\s+office)\b/i);
  if (officeMatch?.[1]) {
    const value = officeMatch[1].trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function detectWarrantyWindow(text: string) {
  const match = text.match(
    /\bwarranty\b.*?(?:expir(?:ing|es)?|ending)?\s*(?:within|in)?\s*(\d+)\s*(day|days|week|weeks|month|months)/i,
  );
  if (!match?.[1]) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const unit = match[2].toLowerCase();
  if (unit.startsWith("day")) return value;
  if (unit.startsWith("week")) return value * 7;
  if (unit.startsWith("month")) return value * 30;
  return undefined;
}

function detectPurchaseWindow(text: string) {
  const match = text.match(
    /\b(?:bought|purchased|purchase(?:d)?)(?:\s+in|\s+within|\s+during|\s+over)?\s*(?:the\s+last\s+|last\s+|past\s+)?(\d+)\s*(day|days|week|weeks|month|months|year|years)/i,
  );
  if (!match?.[1]) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const unit = match[2].toLowerCase();
  if (unit.startsWith("day")) return value;
  if (unit.startsWith("week")) return value * 7;
  if (unit.startsWith("month")) return value * 30;
  if (unit.startsWith("year")) return value * 365;
  return undefined;
}

function detectSort(text: string): { sortBy?: SortBy; direction?: Direction } {
  if (/\bnewest\b|\blatest\b/.test(text)) {
    return { sortBy: SortBy.UPDATED, direction: Direction.DESC };
  }

  if (/\boldest\b|\bearliest\b/.test(text)) {
    return { sortBy: SortBy.UPDATED, direction: Direction.ASC };
  }

  if (/sort by (?:warranty|warranty end|warranty date)/.test(text)) {
    return { sortBy: SortBy.WARRANTY_END, direction: Direction.ASC };
  }

  if (/sort by (?:purchase|purchased|purchase date)/.test(text)) {
    return { sortBy: SortBy.PURCHASE_DATE, direction: Direction.DESC };
  }

  if (/sort by created|newly added|recently added/.test(text)) {
    return { sortBy: SortBy.CREATED, direction: Direction.DESC };
  }

  if (/updated (?:oldest|ascending)/.test(text)) {
    return { sortBy: SortBy.UPDATED, direction: Direction.ASC };
  }

  if (/updated (?:newest|descending)/.test(text)) {
    return { sortBy: SortBy.UPDATED, direction: Direction.DESC };
  }

  return {};
}

function interpretFromSpec(spec: FilterSpec, message: string) {
  const parts: string[] = [];
  if (spec.category) parts.push(spec.category);
  if (spec.statuses?.length) parts.push(spec.statuses.join(", ").toLowerCase());
  if (spec.location) parts.push(`at ${spec.location}`);
  if (spec.assignedTo) parts.push(`assigned to ${spec.assignedTo}`);
  if (spec.warrantyExpiringInDays) parts.push(`warranty expiring in ${spec.warrantyExpiringInDays} days`);
  if (spec.purchasedWithinDays) parts.push(`purchased within ${spec.purchasedWithinDays} days`);
  if (spec.sortBy) parts.push(`sorted by ${spec.sortBy.toLowerCase()}`);
  if (spec.direction) parts.push(spec.direction === Direction.ASC ? "oldest first" : "newest first");
  return parts.length ? parts.join(", ") : normalizeQueryText(message);
}

function carryOverExistingValue(
  message: string,
  currentFilter: Partial<FilterSpec> | undefined,
  key: "location" | "category",
) {
  if (!currentFilter?.[key]) return undefined;
  const patterns = [
    new RegExp(`\\bkeep (?:the )?${key}\\b`, "i"),
    new RegExp(`\\bsame ${key}\\b`, "i"),
    new RegExp(`\\bexisting ${key}\\b`, "i"),
  ];
  return patterns.some((pattern) => pattern.test(message)) ? currentFilter[key] : undefined;
}

function applyHeuristicParser(input: BuildFilterSpecInput): BuildFilterSpecResult {
  const text = normalizeQueryText(input.message.toLowerCase());
  const spec: Partial<FilterSpec> = {};

  const statuses = detectStatuses(text);
  if (statuses.length) {
    spec.statuses = statuses;
  }

  const category = detectCategory(text) ?? carryOverExistingValue(input.message, input.currentFilter, "category");
  if (category) {
    spec.category = category;
  }

  const assignedTo = detectAssignedTo(text);
  if (assignedTo) {
    spec.assignedTo = assignedTo;
    if (!spec.statuses?.length && text.includes("assigned")) {
      spec.statuses = [Status.ASSIGNED];
    }
  }

  const location = detectLocation(text) ?? carryOverExistingValue(input.message, input.currentFilter, "location");
  if (location) {
    spec.location = location;
  }

  const warrantyExpiringInDays = detectWarrantyWindow(text);
  if (warrantyExpiringInDays) {
    spec.warrantyExpiringInDays = warrantyExpiringInDays;
    spec.sortBy = spec.sortBy ?? SortBy.WARRANTY_END;
    spec.direction = spec.direction ?? Direction.ASC;
  }

  const purchasedWithinDays = detectPurchaseWindow(text);
  if (purchasedWithinDays) {
    spec.purchasedWithinDays = purchasedWithinDays;
    spec.sortBy = spec.sortBy ?? SortBy.PURCHASE_DATE;
    spec.direction = spec.direction ?? Direction.DESC;
  }

  const sort = detectSort(text);
  if (sort.sortBy) spec.sortBy = sort.sortBy;
  if (sort.direction) spec.direction = sort.direction;

  const normalizedSpec = normalizeFilterSpec({
    ...input.currentFilter,
    ...spec,
  });

  return {
    interpretedQuery: interpretFromSpec(normalizedSpec, input.message),
    filterSpec: normalizedSpec,
  };
}

async function callOpenAi(input: BuildFilterSpecInput): Promise<BuildFilterSpecResult | null> {
  const { provider, apiKey, model } = getOpenAiConfig();
  if (provider !== "openai" || !apiKey) return null;

  const systemPrompt = `
You translate natural language into a filter spec for an IT asset table. Respond with STRICT JSON only.
Schema:
{
  "interpretedQuery": "short paraphrase of the user's ask",
  "filterSpec": {
    "search": string,
    "category": string,
    "location": string,
    "statuses": ["IN_STOCK" | "ASSIGNED" | "REPAIR" | "RETIRED"],
    "assignedTo": string,
    "warrantyExpiringInDays": number,
    "purchasedWithinDays": number,
    "sortBy": "UPDATED" | "CREATED" | "WARRANTY_END" | "PURCHASE_DATE",
    "direction": "ASC" | "DESC",
    "limit": number
  },
  "followUpQuestion": "ask a short question if the request is ambiguous"
}
Rules:
- Keep answers scoped to workspace ${input.workspaceId}; never suggest creating or querying other workspaces.
- Prefer values from the current filter when the user asks to keep or reuse them.
- Do not invent data. If unsure, set followUpQuestion instead of guessing.
- Only return the JSON object, no prose.
Current filter (may be empty): ${JSON.stringify(input.currentFilter ?? {})}
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

  let parsed: z.infer<typeof aiResponseSchema>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const aiResult = aiResponseSchema.safeParse(parsed);
  if (!aiResult.success) return null;

  const normalized = aiResult.data.filterSpec
    ? filterSpecSchema.safeParse(normalizeFilterSpec(aiResult.data.filterSpec as Partial<FilterSpec>))
    : null;

  if (normalized && normalized.success) {
    return {
      interpretedQuery: aiResult.data.interpretedQuery || normalizeQueryText(input.message),
      filterSpec: { ...normalized.data, limit: normalized.data.limit ?? 50 },
      followUpQuestion: aiResult.data.followUpQuestion,
    };
  }

  if (aiResult.data.followUpQuestion) {
    return {
      interpretedQuery: aiResult.data.interpretedQuery || normalizeQueryText(input.message),
      followUpQuestion: aiResult.data.followUpQuestion,
    };
  }

  return null;
}

export async function buildFilterSpec(input: BuildFilterSpecInput): Promise<BuildFilterSpecResult> {
  if (!input.message.trim()) {
    return {
      interpretedQuery: "",
      followUpQuestion: "Tell me how you want to filter assets (e.g., laptops in repair at HQ).",
    };
  }

  const aiResult = await callOpenAi(input).catch(() => null);
  if (aiResult?.filterSpec) {
    return aiResult;
  }

  const heuristic = applyHeuristicParser(input);
  const hasMeaningfulFilter = heuristic.filterSpec
    ? Object.entries(heuristic.filterSpec).some(([key, value]) => key !== "limit" && value !== undefined)
    : false;
  if (heuristic.filterSpec && hasMeaningfulFilter) {
    return heuristic;
  }

  return (
    aiResult ?? {
      interpretedQuery: normalizeQueryText(input.message),
      followUpQuestion: "I couldn't validate that filter. Could you clarify the status, category, or location you need?",
    }
  );
}
