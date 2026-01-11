import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const locations = ["NYC HQ", "KL Office", "Remote", "LA Office", "London Hub"];
const brands = ["Dell", "HP", "Apple", "Lenovo", "Acer", "Asus"];
const models = ["Pro 14", "Elite 840", "Latitude 5440", "ThinkPad X1", "MacBook Air", "iPad Pro 11"];
const categories = ["Laptop", "Desktop", "Monitor", "Phone", "iPad"];
const accessoriesOptions = ["Pencil", "Keyboard case", "Folio cover", "Smart Keyboard", "Case", "Magic Keyboard"];
const force = process.argv.includes("--force");

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateWithinDays(days: number) {
  const now = new Date();
  const offset = Math.floor(Math.random() * days);
  const d = new Date(now);
  d.setDate(now.getDate() - offset);
  return d;
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function randomImei() {
  let imei = "";
  for (let i = 0; i < 15; i += 1) {
    imei += Math.floor(Math.random() * 10);
  }
  return imei;
}

async function main() {
  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      assetTag: true,
      category: true,
      brand: true,
      model: true,
      location: true,
      purchaseDate: true,
      warrantyEnd: true,
      serialNumber: true,
      imeiNumber: true,
      deviceSpec: true,
      status: true,
      accessories: true,
    },
  });

  let updates = 0;
  for (const asset of assets) {
    const data: Record<string, any> = {};

    const missing = (value: unknown) =>
      force || value === null || value === undefined || (typeof value === "string" && value.trim() === "");

    if (missing(asset.category)) data.category = pick(categories);
    if (missing(asset.brand)) data.brand = pick(brands);
    if (missing(asset.model)) data.model = pick(models);
    if (missing(asset.location)) data.location = pick(locations);
    if (missing(asset.serialNumber)) data.serialNumber = `SN-${asset.assetTag}`;

    if (missing(asset.purchaseDate)) {
      const purchaseDate = randomDateWithinDays(900);
      data.purchaseDate = purchaseDate;
      data.warrantyEnd = addYears(purchaseDate, 3);
    } else if (asset.purchaseDate && missing(asset.warrantyEnd)) {
      data.warrantyEnd = addYears(asset.purchaseDate, 3);
    }

    const isIpad = (asset.category || data.category || "").toLowerCase().includes("ipad");
    if (isIpad) {
      if (missing(asset.imeiNumber)) data.imeiNumber = randomImei();
      if (missing(asset.deviceSpec)) data.deviceSpec = "256GB, Wi-Fi + Cellular";
      if (missing((asset as any).accessories)) data.accessories = `${pick(accessoriesOptions)}, Charger`;
    }

    if (Object.keys(data).length) {
      await prisma.asset.update({
        where: { id: asset.id },
        data,
      });
      updates += 1;
    }
  }

  console.log(`Updated ${updates} assets with generated details.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

