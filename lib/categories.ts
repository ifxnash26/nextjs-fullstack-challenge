import { prisma } from "@/lib/prisma";

const DEFAULT_CATEGORIES = ["Laptop", "Desktop", "Monitor", "Phone", "iPad"];

export function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCategoryKey(value: string) {
  return normalizeCategoryName(value).toLowerCase();
}

export async function listCategoryOptions(workspaceId: string) {
  const categories = new Map<string, string>();
  for (const category of DEFAULT_CATEGORIES) {
    categories.set(normalizeCategoryKey(category), category);
  }

  const rows = await prisma.asset.findMany({
    where: { workspaceId, deletedAt: null, category: { not: null } },
    distinct: ["category"],
    select: { category: true },
  });

  for (const row of rows) {
    const name = normalizeCategoryName(row.category ?? "");
    if (!name) continue;
    const normalizedName = normalizeCategoryKey(name);
    categories.set(normalizedName, name);
  }

  return Array.from(categories.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export async function resolveCategoryName(workspaceId: string, rawName?: string | null) {
  if (typeof rawName !== "string") return undefined;
  const name = normalizeCategoryName(rawName);
  if (!name) return undefined;

  const categories = await listCategoryOptions(workspaceId);
  const normalizedName = normalizeCategoryKey(name);
  const match = categories.find((category) => normalizeCategoryKey(category) === normalizedName);

  return match ?? name;
}
