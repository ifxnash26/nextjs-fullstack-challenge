import prisma from "@/lib/db";
import type { Note, PrismaClient } from "@prisma/client";
import type { CreateNoteInput } from "../validation";

type DbClient = PrismaClient;

export async function listNotes(userId: string, db: DbClient = prisma) {
  return db.note.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(
  userId: string,
  input: CreateNoteInput,
  db: DbClient = prisma
): Promise<Note> {
  return db.note.create({
    data: {
      title: input.title,
      content: input.content,
      userId,
    },
  });
}

export async function deleteNote(userId: string, noteId: string, db: DbClient = prisma) {
  return db.note.deleteMany({
    where: { id: noteId, userId },
  });
}
