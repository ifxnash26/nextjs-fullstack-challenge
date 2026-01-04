import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  await clearSession();
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete("session_token");
  return res;
}
