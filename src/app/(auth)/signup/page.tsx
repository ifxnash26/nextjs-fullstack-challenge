import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata = {
  title: "Sign up",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;

  return (
    <main className="page">
      <SignupForm />
      {error ? <p className="error">{error}</p> : null}
      <p>
        Already have an account? <Link href="/login">Login</Link>
      </p>
    </main>
  );
}
