import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdapter?: PrismaPg;
  prismaPool?: Pool;
};

const fallbackUrl = "postgresql://app:app_pw@localhost:5432/app_db?schema=public";
const datasourceUrl =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === "test"
    ? "postgresql://user:pass@localhost:5432/testdb"
    : fallbackUrl);

if (!datasourceUrl) {
  throw new Error("DATABASE_URL environment variable is required to initialize Prisma.");
}

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: datasourceUrl,
  });

const adapter = globalForPrisma.prismaAdapter ?? new PrismaPg(pool);

const prismaOptions: Prisma.PrismaClientOptions = {
  adapter,
  log: process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"],
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaAdapter = adapter;
  globalForPrisma.prismaPool = pool;
}

export default prisma;
