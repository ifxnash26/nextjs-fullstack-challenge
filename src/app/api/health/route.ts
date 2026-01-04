import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();

  await prisma.$queryRaw`SELECT 1`;

  return NextResponse.json({
    ok: true,
    db: "connected",
    time: new Date(startedAt).toISOString(),
  });
}
