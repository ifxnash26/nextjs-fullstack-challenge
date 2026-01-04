'use client';

import { useActionState } from "react";
import { createTaskAction } from "@/server/actions/tasks";

type ActionState = { error?: string };
const initialState: ActionState = {};

export function TaskForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createTaskAction, initialState);

  return (
    <form action={formAction} className="card">
      <h2>Create task</h2>
      <input name="title" placeholder="Task title" required maxLength={200} />
      {state?.error ? <p className="error">{state.error}</p> : null}
      <button type="submit">Add task</button>
    </form>
  );
}
