import { AssetStatus } from "@prisma/client";
import { type AssistantIntent } from "./ai";

type ModelIntent = AssistantIntent;

const MODEL_NAME = process.env.AI_MODEL || "gpt-3.5-turbo-0125";
const API_KEY = process.env.AI_API_KEY;

function normalizeStatus(value?: string | null): AssetStatus | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase().replace(/\s+/g, "_");
  return Object.values(AssetStatus).includes(upper as AssetStatus) ? (upper as AssetStatus) : undefined;
}

export function isAiEnabled() {
  return Boolean(API_KEY);
}

export async function getAssistantIntentFromModel(text: string): Promise<ModelIntent | null> {
  if (!API_KEY) return null;

  const systemPrompt = `
You are an intent parser for an IT asset manager. Return ONLY JSON with no extra text.
Schema:
- intent: "filter" | "update" | "create" | "delete"
- spec: { search?: string; assetTags?: string[]; statuses?: string[]; category?: string; location?: string; vendor?: string; assignedTo?: string }
- update: { status?: string; category?: string; assignedTo?: string }
- create: { count: number; tagPrefix: string; tagStart: number; tagWidth: number; category?: string; status?: string }
Rules:
- For updates or deletes, include a filter spec describing which assets to change.
- statuses must be one of IN_STOCK, ASSIGNED, REPAIR, RETIRED (uppercase).
- assignedTo is a person name string, do not invent IDs.
- For create, infer a tag pattern (prefix + start + width) from any sample tag mentioned.
- If you cannot parse, return: {"intent":"unknown","message":"..."}.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: ModelIntent;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return null;
  }

  if (parsed.intent === "filter" && parsed.spec) {
    if (parsed.spec.statuses) {
      parsed.spec.statuses = parsed.spec.statuses
        .map((status) => normalizeStatus(status))
        .filter(Boolean) as AssetStatus[];
    }
    return parsed;
  }

  if (parsed.intent === "update" && parsed.spec && parsed.update) {
    if (parsed.spec.statuses) {
      parsed.spec.statuses = parsed.spec.statuses
        .map((status) => normalizeStatus(status))
        .filter(Boolean) as AssetStatus[];
    }
    if (parsed.update.status) {
      const status = normalizeStatus(parsed.update.status);
      parsed.update.status = status;
      if (!status) return null;
    }
    return parsed;
  }

  if (parsed.intent === "create" && parsed.create) {
    if (parsed.create.status) {
      const status = normalizeStatus(parsed.create.status);
      parsed.create.status = status;
    }
    return parsed;
  }

  if (parsed.intent === "delete" && parsed.spec) {
    if (parsed.spec.statuses) {
      parsed.spec.statuses = parsed.spec.statuses
        .map((status) => normalizeStatus(status))
        .filter(Boolean) as AssetStatus[];
    }
    return parsed;
  }

  if (parsed.intent === "unknown") return parsed;

  return null;
}
