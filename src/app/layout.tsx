import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task & Notes",
  description: "Manage tasks and notes with authentication",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: "1rem 2rem", borderBottom: "1px solid #1f2937", background: "#0d0e13" }}>
          <nav style={{ display: "flex", alignItems: "center", gap: "1rem", color: "#e5e7eb" }}>
            <Link href="/" style={{ fontWeight: 700, color: "inherit", textDecoration: "none" }}>
              Task & Notes
            </Link>
            <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.95rem" }}>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/login">Login</Link>
              <Link href="/signup">Signup</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
