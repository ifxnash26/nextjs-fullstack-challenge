/// <reference types="vitest" />

import { createTaskSchema, signupSchema } from "./validation";

describe("validation", () => {
  it("rejects invalid signup email", () => {
    const result = signupSchema.safeParse({ email: "bad", password: "secret12", name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid task title", () => {
    const parsed = createTaskSchema.parse({ title: "Ship feature" });
    expect(parsed.title).toBe("Ship feature");
  });
});
