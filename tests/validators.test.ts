import { AssetStatus, Role } from "@prisma/client";
import { assetInputSchema, credentialsSchema, filterSpecSchema, userCreateSchema } from "@/lib/validators";
import { describe, expect, it } from "vitest";

describe("validators", () => {
  it("parses credentials and lowercases email", () => {
    const parsed = credentialsSchema.parse({ email: "User@Example.com", password: "secret123" });
    expect(parsed.email).toBe("user@example.com");
  });

  it("validates asset input and defaults status", () => {
    const parsed = assetInputSchema.parse({ assetTag: "AS-1" });
    expect(parsed.status).toBe(AssetStatus.IN_STOCK);
    expect(parsed.assetTag).toBe("AS-1");
  });

  it("accepts filter spec structure", () => {
    const parsed = filterSpecSchema.parse({ statuses: [AssetStatus.REPAIR], vendor: "cdw" });
    expect(parsed.vendor).toBe("cdw");
    expect(parsed.statuses?.[0]).toBe(AssetStatus.REPAIR);
  });

  it("validates user create payload", () => {
    const parsed = userCreateSchema.parse({ email: "ops@example.com", password: "supersecure", role: Role.ADMIN });
    expect(parsed.role).toBe(Role.ADMIN);
  });
});
