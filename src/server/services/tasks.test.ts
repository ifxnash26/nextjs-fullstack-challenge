/// <reference types="vitest" />

import { createTask } from "./tasks";

describe("createTask service", () => {
  it("passes normalized data to the client", async () => {
    const create = vi.fn(async (opts) => ({
      id: "t1",
      ...opts.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const fakeDb = {
      task: {
        create,
      },
    } as unknown as import("@prisma/client").PrismaClient;

    const result = await createTask("user-1", { title: "Write tests" }, fakeDb);

    expect(create).toHaveBeenCalledWith({
      data: { title: "Write tests", userId: "user-1", done: false },
    });
    expect(result.id).toBe("t1");
  });
});
