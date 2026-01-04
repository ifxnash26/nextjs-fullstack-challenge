import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import type { Session, User } from "@prisma/client";
import { randomUUID } from "crypto";

const SESSION_COOKIE = "session_token";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type SessionWithUser = Session & { user: User };

export async function getSession(): Promise<SessionWithUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    await clearSession();
    return null;
  }

  return session;
}

export async function createSessionRecord(userId: string) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.user;
}
