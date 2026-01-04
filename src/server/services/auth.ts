import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import type { PrismaClient, User } from "@prisma/client";
import type { SignupInput } from "../validation";

type DbClient = PrismaClient;

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createUser(
  data: SignupInput & { passwordHash: string },
  db: DbClient = prisma
): Promise<User> {
  return db.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
    },
  });
}

export async function findUserByEmail(email: string, db: DbClient = prisma) {
  return db.user.findUnique({ where: { email } });
}
