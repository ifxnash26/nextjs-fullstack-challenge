'use server';

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createTask, deleteTask, toggleTask } from "../services/tasks";
import { createTaskSchema, idSchema } from "../validation";

type ActionState = { error?: string };

export async function createTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const user = await requireUser();
  await createTask(user.id, parsed.data);
  revalidatePath("/dashboard");
  return {};
}

export async function toggleTaskAction(formData: FormData): Promise<void> {
  const idResult = idSchema.safeParse(formData.get("id"));
  if (!idResult.success) {
    return;
  }
  const done = formData.get("done") === "true";

  const user = await requireUser();
  await toggleTask(user.id, idResult.data, done);
  revalidatePath("/dashboard");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const idResult = idSchema.safeParse(formData.get("id"));
  if (!idResult.success) {
    return;
  }

  const user = await requireUser();
  await deleteTask(user.id, idResult.data);
  revalidatePath("/dashboard");
}
