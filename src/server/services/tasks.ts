import prisma from "@/lib/db";
import type { PrismaClient, Task } from "@prisma/client";
import type { CreateTaskInput, TaskFilter } from "../validation";

type DbClient = PrismaClient;

export async function listTasks(userId: string, filter: TaskFilter = "all", db: DbClient = prisma) {
  const where =
    filter === "done"
      ? { userId, done: true }
      : filter === "not-done"
        ? { userId, done: false }
        : { userId };

  return db.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function createTask(
  userId: string,
  input: CreateTaskInput,
  db: DbClient = prisma
): Promise<Task> {
  return db.task.create({
    data: {
      title: input.title,
      userId,
      done: false,
    },
  });
}

export async function toggleTask(
  userId: string,
  taskId: string,
  done: boolean,
  db: DbClient = prisma
) {
  return db.task.updateMany({
    where: { id: taskId, userId },
    data: { done },
  });
}

export async function deleteTask(userId: string, taskId: string, db: DbClient = prisma) {
  return db.task.deleteMany({
    where: { id: taskId, userId },
  });
}
