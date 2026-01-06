import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deriveFiltersFromText } from "@/lib/ai";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const filterSpec = deriveFiltersFromText(String(body.text));
  return NextResponse.json(filterSpec);
}
