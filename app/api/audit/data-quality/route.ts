import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getWorkspaceMembership } from "@/lib/workspaces";
import { auditDataQuality } from "@/server/audit/dataQuality";
import { assetFilterSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filtersResult = assetFilterSchema.partial().safeParse(body?.filters ?? {});
  const filters = filtersResult.success ? filtersResult.data : undefined;

  try {
    const report = await auditDataQuality(workspaceId, { filters });
    return NextResponse.json(report);
  } catch (error) {
    console.error("auditDataQuality failed", error);
    return NextResponse.json(
      {
        error:
          "Unable to run audit. Please ensure the database schema is up to date (run prisma migrate/db push) and try again.",
      },
      { status: 500 },
    );
  }
}
