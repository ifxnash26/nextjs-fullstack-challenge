import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { PrismaClient, AssetStatus, Role } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

type CsvRow = {
  assetTag: string;
  category?: string;
  brand?: string;
  model?: string;
  status?: string;
  location?: string;
  purchaseDate?: string;
  warrantyEnd?: string;
  serialNumber?: string;
  imeiNumber?: string;
  deviceSpec?: string;
  accessories?: string;
  assignedTo?: string;
  notes?: string;
};

const prisma = new PrismaClient();

function normalizeStatus(value?: string | null): AssetStatus | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase().replace(/[\s-]+/g, "_");
  const normalized = upper === "IN_USED" || upper === "IN_USE" ? "ASSIGNED" : upper;
  return Object.values(AssetStatus).includes(normalized as AssetStatus)
    ? (normalized as AssetStatus)
    : undefined;
}

async function main() {
  const csvPath = path.join(process.cwd(), "assets.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`assets.csv not found at ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];

  const workspaces = await prisma.workspace.findMany({ orderBy: { createdAt: "asc" }, take: 1 });
  if (!workspaces.length) throw new Error("No workspace found.");
  const workspaceId = workspaces[0].id;

  let upserts = 0;
  for (const row of rows) {
    const assetTag = row.assetTag?.trim().toUpperCase();
    if (!assetTag) continue;
    const status = normalizeStatus(row.status) ?? AssetStatus.IN_STOCK;

    let assignedToId: string | undefined;
    if (row.assignedTo) {
      const person = await prisma.person.upsert({
        where: { workspaceId_name: { workspaceId, name: row.assignedTo } },
        update: {},
        create: { workspaceId, name: row.assignedTo },
        select: { id: true },
      });
      assignedToId = person.id;
    }

    await prisma.asset.upsert({
      where: { workspaceId_assetTag: { workspaceId, assetTag } },
      update: {
        category: row.category || undefined,
        brand: row.brand || undefined,
        model: row.model || undefined,
        status,
        location: row.location || undefined,
        purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : undefined,
        warrantyEnd: row.warrantyEnd ? new Date(row.warrantyEnd) : undefined,
        serialNumber: row.serialNumber || undefined,
        imeiNumber: row.imeiNumber || undefined,
        deviceSpec: row.deviceSpec || undefined,
        accessories: row.accessories || undefined,
        assignedToId: assignedToId ?? undefined,
        notes: row.notes || undefined,
      },
      create: {
        workspaceId,
        assetTag,
        category: row.category || undefined,
        brand: row.brand || undefined,
        model: row.model || undefined,
        status,
        location: row.location || undefined,
        purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : undefined,
        warrantyEnd: row.warrantyEnd ? new Date(row.warrantyEnd) : undefined,
        serialNumber: row.serialNumber || undefined,
        imeiNumber: row.imeiNumber || undefined,
        deviceSpec: row.deviceSpec || undefined,
        accessories: row.accessories || undefined,
        assignedToId: assignedToId ?? undefined,
        notes: row.notes || undefined,
      },
    });
    upserts += 1;
  }

  console.log(`Upserted ${upserts} assets into workspace ${workspaceId}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
