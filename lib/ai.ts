import { AssetStatus } from "@prisma/client";
import { AssetFilterInput, FilterSpec } from "./validators";

const statusKeywords: Record<AssetStatus, string[]> = {
  [AssetStatus.IN_STOCK]: ["in stock", "in-stock", "in_stock", "available", "inventory"],
  [AssetStatus.ASSIGNED]: ["assigned", "in use", "in-use", "in_use", "checked out", "checked-out"],
  [AssetStatus.REPAIR]: ["repair", "repairs", "fix", "broken", "needs repair"],
  [AssetStatus.RETIRED]: ["retired", "decommissioned", "disposed"],
};

const updateVerbs = ["change", "update", "set", "mark", "make", "move", "switch"];
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
  return matches.length === 1 ? matches[0] : null;
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

export function deriveFiltersFromText(text: string): FilterSpec {
  const normalized = text.toLowerCase();
  const statuses: AssetStatus[] = [];

  for (const [status, keywords] of Object.entries(statusKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      statuses.push(status as AssetStatus);
    }
  }

  const vendorMatch = normalized.match(/from ([a-z0-9\s]+)/);
  const locationMatch = normalized.match(/in ([a-z0-9\s]+) office/);

  const spec: FilterSpec = {};
  if (statuses.length) spec.statuses = Array.from(new Set(statuses));
  if (vendorMatch) spec.vendor = vendorMatch[1].trim();
  if (locationMatch) spec.location = locationMatch[1].trim();

  const cleaned = normalized
    .replace(createStatusRegex("g"), "")
    .replace(/from [a-z0-9\s]+/g, "")
    .replace(/in [a-z0-9\s]+ office/g, "")
    .trim();
  const search = stripFilterWords(cleaned);
  if (search) spec.search = search;

  return spec;
}

export function filterSpecToAssetFilterInput(spec: FilterSpec): AssetFilterInput {
  return {
    q: spec.search,
    assetTags: spec.assetTags,
    status: spec.statuses,
    category: spec.category,
    location: spec.location,
    vendor: spec.vendor,
    assignedTo: spec.assignedTo,
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
  | { intent: "update"; spec: FilterSpec; update: { status?: AssetStatus; category?: string } }
  | { intent: "create"; create: CreateSpec }
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
  const hasVerb = hasUpdateVerb(normalized);

  if (hasVerb && (targetStatus || targetCategory)) {
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
      },
    };
  }

  if (hasVerb) {
    return {
      intent: "unknown",
      message:
        "I can update status or category with requests like \"change all ipads to assigned\" or \"set category to ipad for MYIPAD0307-MYIPAD0374\".",
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
