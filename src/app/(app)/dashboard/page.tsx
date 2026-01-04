import { NoteForm } from "./NoteForm";
import { TaskForm } from "./TaskForm";
import { listNotes } from "@/server/services/notes";
import { listTasks } from "@/server/services/tasks";
import { requireUser } from "@/lib/auth/session";
import { taskFilterSchema } from "@/server/validation";
import { deleteNoteAction } from "@/server/actions/notes";
import { deleteTaskAction, toggleTaskAction } from "@/server/actions/tasks";

type DashboardPageProps = {
  searchParams: Promise<{ filter?: string }>;
};

const toggleTaskActionServer = async (formData: FormData) => {
  "use server";
  await toggleTaskAction(formData);
};

const deleteTaskActionServer = async (formData: FormData) => {
  "use server";
  await deleteTaskAction(formData);
};

const deleteNoteActionServer = async (formData: FormData) => {
  "use server";
  await deleteNoteAction(formData);
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filterParse = taskFilterSchema.safeParse(params?.filter ?? "all");
  const filter = filterParse.success ? filterParse.data : "all";

  const [tasks, notes] = await Promise.all([listTasks(user.id, filter), listNotes(user.id)]);

  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <h1>Dashboard</h1>
        <form action="/api/auth/logout" method="post">
          <button type="submit">Logout</button>
        </form>
      </div>

      <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <TaskForm />
        <NoteForm />
      </section>

      <section className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Tasks</h2>
          <Filters active={filter} />
        </div>
        <div className="list">
          {tasks.length === 0 ? (
            <p className="muted">No tasks yet.</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="list-item">
                <div>
                  <strong>{task.title}</strong>
                  <div className="muted">{task.done ? "Done" : "Not done"}</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <form action={toggleTaskActionServer}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="done" value={task.done ? "false" : "true"} />
                    <button type="submit">{task.done ? "Mark not done" : "Mark done"}</button>
                  </form>
                  <form action={deleteTaskActionServer}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit">Delete</button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h2>Notes</h2>
        <div className="list">
          {notes.length === 0 ? (
            <p className="muted">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="list-item">
                <div>
                  <strong>{note.title}</strong>
                  <p className="muted" style={{ margin: 0 }}>
                    {note.content}
                  </p>
                </div>
                <form action={deleteNoteActionServer}>
                  <input type="hidden" name="id" value={note.id} />
                  <button type="submit">Delete</button>
                </form>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Filters({ active }: { active: "all" | "done" | "not-done" }) {
  const filters: { label: string; value: typeof active }[] = [
    { label: "All", value: "all" },
    { label: "Done", value: "done" },
    { label: "Not done", value: "not-done" },
  ];

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      {filters.map((f) => (
        <a
          key={f.value}
          href={`/dashboard?filter=${f.value}`}
          style={{
            padding: "0.4rem 0.7rem",
            borderRadius: "999px",
            border: "1px solid #1f2937",
            background: active === f.value ? "#2563eb" : "#0d0e13",
            color: active === f.value ? "white" : "#e5e7eb",
            textDecoration: "none",
          }}
        >
          {f.label}
        </a>
      ))}
    </div>
  );
}
