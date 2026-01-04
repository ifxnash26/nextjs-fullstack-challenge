import { NextResponse } from "next/server";
import { createSessionRecord } from "@/lib/auth/session";
import { findUserByEmail, verifyPassword } from "@/server/services/auth";
import { loginSchema } from "@/server/validation";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      const res = NextResponse.redirect(new URL("/login?error=Invalid%20input", req.url));
      return res;
    }

    const user = await findUserByEmail(parsed.data.email);
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!user || !valid) {
      const res = NextResponse.redirect(new URL("/login?error=Invalid%20credentials", req.url));
      return res;
    }

    const { token, expiresAt } = await createSessionRecord(user.id);
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set({
      name: "session_token",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.redirect(new URL("/login?error=Server%20error", req.url));
  }
}
