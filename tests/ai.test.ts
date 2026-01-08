import { describe, expect, it } from "vitest";
import { AssetStatus } from "@prisma/client";
import { deriveAssistantAction, deriveFiltersFromText } from "@/lib/ai";

describe("ai filter parsing", () => {
  it("strips command verbs from search queries", () => {
    expect(deriveFiltersFromText("show ipad")).toEqual({ search: "ipad" });
  });

  it("keeps status filters while removing filler words", () => {
    expect(deriveFiltersFromText("show all assigned devices")).toEqual({ statuses: [AssetStatus.ASSIGNED] });
  });
});

describe("ai create parsing", () => {
  it("parses tag ranges and category hints", () => {
    const result = deriveAssistantAction(
      "add all the ipad to ipad category from MYIPAD0307 until MYIPAD0374 to ipad category",
    );

    expect(result.intent).toBe("create");
    if (result.intent !== "create") return;

    expect(result.create.tagPrefix).toBe("myipad");
    expect(result.create.tagStart).toBe(307);
    expect(result.create.tagWidth).toBe(4);
    expect(result.create.count).toBe(68);
    expect(result.create.category).toBe("ipad");
  });
});

describe("ai update parsing", () => {
  it("updates category with an asset tag range", () => {
    const result = deriveAssistantAction("set category to ipad for MYIPAD0307-MYIPAD0374");

    expect(result.intent).toBe("update");
    if (result.intent !== "update") return;

    expect(result.update.category).toBe("ipad");
    expect(result.spec.assetTags?.[0]).toBe("MYIPAD0307");
    expect(result.spec.assetTags?.[result.spec.assetTags.length - 1]).toBe("MYIPAD0374");
  });

  it("parses assignee updates", () => {
    const result = deriveAssistantAction("assign one ipad to muhammad irfan");

    expect(result.intent).toBe("update");
    if (result.intent !== "update") return;

    expect(result.update.assignedTo).toBe("muhammad irfan");
  });

  it("parses delete intents", () => {
    const result = deriveAssistantAction("delete assets in stock");

    expect(result.intent).toBe("delete");
    if (result.intent !== "delete") return;

    expect(result.spec.statuses).toContain(AssetStatus.IN_STOCK);
  });

  it("parses delete intents with category keyword", () => {
    const result = deriveAssistantAction("delete all laptop");

    expect(result.intent).toBe("delete");
    if (result.intent !== "delete") return;

    expect(result.spec.category).toBe("laptop");
  });
});
