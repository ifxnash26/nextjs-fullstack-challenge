import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email" }),
  name: z
    .string()
    .trim()
    .max(100, { message: "Name must be 100 characters or less" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
});

export const taskFilterSchema = z.enum(["all", "done", "not-done"]).default("all");

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }).max(200),
});

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }).max(200),
  content: z.string().trim().min(1, { message: "Content is required" }),
});

export const idSchema = z.string().min(1, { message: "Id is required" });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type TaskFilter = z.infer<typeof taskFilterSchema>;
