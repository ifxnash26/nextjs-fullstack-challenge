"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    const callbackUrl = searchParams.get("callbackUrl") ?? "/";
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid credentials. Please try again.");
      return;
    }

    router.push(result?.url || "/");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="email">
          Work email
        </label>
        <Input id="email" name="email" type="email" placeholder="ops@example.com" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="password">
          Password
        </label>
        <Input id="password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
