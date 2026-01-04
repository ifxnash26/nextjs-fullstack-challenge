import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Login",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;

  return (
    <main className="page">
      <LoginForm />
      {error ? <p className="error">{error}</p> : null}
      <p>
        Need an account? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
