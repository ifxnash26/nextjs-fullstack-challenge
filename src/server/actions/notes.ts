'use server';

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createNote, deleteNote } from "../services/notes";
import { createNoteSchema, idSchema } from "../validation";

type ActionState = { error?: string };

export async function createNoteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createNoteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const user = await requireUser();
  await createNote(user.id, parsed.data);
  revalidatePath("/dashboard");
  return {};
}

export async function deleteNoteAction(formData: FormData): Promise<ActionState | void> {
  const idResult = idSchema.safeParse(formData.get("id"));
  if (!idResult.success) {
    return { error: idResult.error.errors[0]?.message ?? "Invalid input" };
  }

  const user = await requireUser();
  await deleteNote(user.id, idResult.data);
  revalidatePath("/dashboard");
}
