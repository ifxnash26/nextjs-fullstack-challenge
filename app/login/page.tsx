import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session?.user) {
    const workspace = await prisma.workspace.findFirst({
      where: { members: { some: { userId: session.user.id } } },
      orderBy: { createdAt: "asc" },
    });
    redirect(workspace ? `/w/${workspace.id}/assets` : "/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-between gap-12 px-6 py-12">
      <div className="max-w-xl space-y-4">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">AssetSpace AI</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground">Sign in to your workspace</h1>
        <p className="text-muted-foreground">
          Bring clarity to IT asset inventory, assignments, and lifecycle changes. Database-backed sessions keep your security team happy.
        </p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-1 w-8 rounded-full bg-primary" />
          Minimal AI stubs included for natural-language filtering and summaries.
        </div>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm />
          <p className="text-xs text-muted-foreground">
            Need an account? Ask an admin to create one in <Link className="text-primary underline-offset-4 hover:underline" href="/admin/users">Admin &gt; Users</Link>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
