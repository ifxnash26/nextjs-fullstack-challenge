'use client';

import { useActionState } from "react";
import { createNoteAction } from "@/server/actions/notes";

type ActionState = { error?: string };
const initialState: ActionState = {};

export function NoteForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createNoteAction, initialState);

  return (
    <form action={formAction} className="card">
      <h2>Create note</h2>
      <input name="title" placeholder="Note title" required maxLength={200} />
      <textarea name="content" placeholder="Content" required rows={4} />
      {state?.error ? <p className="error">{state.error}</p> : null}
      <button type="submit">Add note</button>
    </form>
  );
}
