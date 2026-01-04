import { NextResponse } from "next/server";
import { createSessionRecord } from "@/lib/auth/session";
import { createUser, findUserByEmail, hashPassword } from "@/server/services/auth";
import { signupSchema } from "@/server/validation";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const parsed = signupSchema.safeParse({
      email: formData.get("email"),
      name: formData.get("name"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return NextResponse.redirect(new URL("/signup?error=Invalid%20input", req.url));
    }

    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      return NextResponse.redirect(new URL("/signup?error=Email%20already%20in%20use", req.url));
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createUser({ ...parsed.data, passwordHash });

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
    console.error("Signup error:", err);
    return NextResponse.redirect(new URL("/signup?error=Server%20error", req.url));
  }
}
