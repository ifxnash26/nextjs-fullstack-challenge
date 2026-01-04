export default function HomePage() {
  return (
    <main className="page">
      <div className="card">
        <h1>Task & Notes</h1>
        <p className="muted">A simple dashboard to manage tasks and notes with credentials-based auth.</p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <a href="/signup" className="button-link">
            Get started
          </a>
          <a href="/login" className="button-link secondary">
            Login
          </a>
        </div>
      </div>
    </main>
  );
}
