import { describe, expect, it, beforeAll } from "vitest";
import { buildFilterSpec } from "@/server/ai/buildFilterSpec";
import { Direction, SortBy, Status, filterSpecSchema, normalizeFilterSpec } from "@/server/ai/filterSpec";

beforeAll(() => {
  process.env.AI_PROVIDER = "mock";
  delete process.env.OPENAI_API_KEY;
});

describe("heuristic filter parsing", () => {
  it("parses laptops in repair at HQ", async () => {
    const result = await buildFilterSpec({ message: "laptops in repair at HQ", workspaceId: "ws1" });
    expect(result.filterSpec?.category).toBe("laptop");
    expect(result.filterSpec?.statuses).toContain(Status.REPAIR);
    expect(result.filterSpec?.location).toBe("hq");
  });

  it("detects assignee and status", async () => {
    const result = await buildFilterSpec({ message: "ipads assigned to ali", workspaceId: "ws1" });
    expect(result.filterSpec?.category).toBe("ipad");
    expect(result.filterSpec?.assignedTo).toBe("ali");
    expect(result.filterSpec?.statuses).toContain(Status.ASSIGNED);
  });

  it("captures warranty window", async () => {
    const result = await buildFilterSpec({ message: "warranty expiring in 30 days", workspaceId: "ws1" });
    expect(result.filterSpec?.warrantyExpiringInDays).toBe(30);
    expect(result.filterSpec?.sortBy).toBe(SortBy.WARRANTY_END);
  });

  it("matches retired assets", async () => {
    const result = await buildFilterSpec({ message: "retired assets", workspaceId: "ws1" });
    expect(result.filterSpec?.statuses).toContain(Status.RETIRED);
  });

  it("detects sort direction newest first", async () => {
    const result = await buildFilterSpec({ message: "in stock, newest first", workspaceId: "ws1" });
    expect(result.filterSpec?.statuses).toContain(Status.IN_STOCK);
    expect(result.filterSpec?.sortBy).toBe(SortBy.UPDATED);
    expect(result.filterSpec?.direction).toBe(Direction.DESC);
  });

  it("parses location and warranty with months", async () => {
    const result = await buildFilterSpec({
      message: "KL office laptops warranty expiring within 2 months",
      workspaceId: "ws1",
    });
    expect(result.filterSpec?.category).toBe("laptop");
    expect(result.filterSpec?.location).toBe("kl office");
    expect(result.filterSpec?.warrantyExpiringInDays).toBe(60);
  });

  it("detects updated oldest first", async () => {
    const result = await buildFilterSpec({ message: "assigned assets updated oldest first", workspaceId: "ws1" });
    expect(result.filterSpec?.statuses).toContain(Status.ASSIGNED);
    expect(result.filterSpec?.sortBy).toBe(SortBy.UPDATED);
    expect(result.filterSpec?.direction).toBe(Direction.ASC);
  });
});

describe("filter spec schema", () => {
  it("normalizes and clamps fields", () => {
    const normalized = normalizeFilterSpec({
      search: "  ipad ",
      statuses: ["assigned", "unknown"] as unknown as Status[],
      warrantyExpiringInDays: 800,
      purchasedWithinDays: 4000,
      sortBy: "warranty_end" as SortBy,
      direction: "asc" as Direction,
      limit: 500,
    });

    expect(normalized.search).toBe("ipad");
    expect(normalized.statuses).toEqual([Status.ASSIGNED]);
    expect(normalized.warrantyExpiringInDays).toBe(365);
    expect(normalized.purchasedWithinDays).toBe(3650);
    expect(normalized.sortBy).toBe(SortBy.WARRANTY_END);
    expect(normalized.direction).toBe(Direction.ASC);
    expect(normalized.limit).toBe(200);
  });

  it("rejects invalid structures", () => {
    const result = filterSpecSchema.safeParse({ limit: 5, search: "" });
    expect(result.success).toBe(false);
  });
});
