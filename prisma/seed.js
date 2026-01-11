/* eslint-disable no-console */
const { PrismaClient, Role, AssetStatus } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "adminadmin";
  const itEmail = process.env.SEED_IT_EMAIL || "it@example.com";
  const itPassword = process.env.SEED_IT_PASSWORD || "ititit";
  const viewerEmail = process.env.SEED_VIEWER_EMAIL || "viewer@example.com";
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD || "viewerviewer";
  const workspaceName = process.env.SEED_WORKSPACE_NAME || "AssetSpace";

  const hashedPassword = await bcrypt.hash(password, 10);

  async function upsertUser({ userEmail, userPassword, name, role }) {
    const hash = await bcrypt.hash(userPassword, 10);
    return prisma.user.upsert({
      where: { email: userEmail },
      update: {},
      create: { email: userEmail, name, hashedPassword: hash, role },
    });
  }

  const admin = await upsertUser({ userEmail: email, userPassword: password, name: "Admin", role: Role.ADMIN });
  const itUser = await upsertUser({ userEmail: itEmail, userPassword: itPassword, name: "IT", role: Role.IT_STAFF });
  const viewerUser = await upsertUser({ userEmail: viewerEmail, userPassword: viewerPassword, name: "Viewer", role: Role.VIEWER });

  const workspace = await prisma.workspace.upsert({
    where: { name: workspaceName },
    update: {},
    create: {
      name: workspaceName,
      ownerId: admin.id,
    },
  });

  async function upsertMembership(userId, workspaceId, role) {
    return prisma.workspaceMember.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      update: { role },
      create: { userId, workspaceId, role },
    });
  }

  await upsertMembership(admin.id, workspace.id, Role.ADMIN);
  await upsertMembership(itUser.id, workspace.id, Role.IT_STAFF);
  await upsertMembership(viewerUser.id, workspace.id, Role.VIEWER);

  const peopleData = [
    { name: "Nash Patel", email: "nash@example.com", title: "IT Technician" },
    { name: "Lee Tan", email: "lee@example.com", title: "Support Engineer" },
    { name: "Ariana Chen", email: "ariana@example.com", title: "Ops Manager" },
    { name: "Jamal Ortega", email: "jamal@example.com", title: "Developer" },
    { name: "Sofia Reyes", email: "sofia@example.com", title: "Product Manager" },
  ];

  const people = await Promise.all(
    peopleData.map((person) =>
      prisma.person.upsert({
        where: {
          workspaceId_name: {
            workspaceId: workspace.id,
            name: person.name,
          },
        },
        update: person,
        create: {
          ...person,
          workspaceId: workspace.id,
        },
      }),
    ),
  );

  const personMap = new Map(people.map((p) => [p.name, p.id]));

  const assets = [
    {
      assetTag: "AS-1001",
      serialNumber: "SN-1001-DEL-5440",
      category: "Laptop",
      brand: "Dell",
      model: "Latitude 5440",
      status: AssetStatus.ASSIGNED,
      location: "NYC HQ",
      purchaseDate: new Date("2024-02-10"),
      warrantyEnd: new Date("2027-02-10"),
      assignedToId: personMap.get("Nash Patel"),
      notes: "Primary field laptop.",
    },
    {
      assetTag: "AS-1002",
      serialNumber: "SN-1002-MBP-14",
      category: "Laptop",
      brand: "Apple",
      model: "MacBook Pro 14",
      status: AssetStatus.ASSIGNED,
      location: "NYC HQ",
      purchaseDate: new Date("2024-03-05"),
      warrantyEnd: new Date("2027-03-05"),
      assignedToId: personMap.get("Ariana Chen"),
      notes: "Design team machine.",
    },
    {
      assetTag: "AS-1003",
      serialNumber: "SN-1003-XPS-13",
      category: "Laptop",
      brand: "Dell",
      model: "XPS 13",
      status: AssetStatus.IN_STOCK,
      location: "KL Office",
      purchaseDate: new Date("2023-12-12"),
      warrantyEnd: new Date("2026-12-12"),
      assignedToId: null,
      notes: "Spare pool.",
    },
    {
      assetTag: "AS-1004",
      serialNumber: "SN-1004-IPAD-11",
      category: "iPad",
      brand: "Apple",
      model: "iPad Pro 11",
      status: AssetStatus.REPAIR,
      location: "KL Office",
      imeiNumber: "205367475044109",
      deviceSpec: "256GB, Wi-Fi + Cellular",
      accessories: "Pencil, Magic Keyboard",
      purchaseDate: new Date("2023-06-01"),
      warrantyEnd: new Date("2025-06-01"),
      assignedToId: personMap.get("Lee Tan"),
      notes: "Screen cracked; in repair queue.",
    },
    {
      assetTag: "AS-1005",
      serialNumber: "SN-1005-MON-27",
      category: "Monitor",
      brand: "LG",
      model: "UltraFine 27",
      status: AssetStatus.IN_STOCK,
      location: "NYC HQ",
      purchaseDate: new Date("2024-04-15"),
      warrantyEnd: new Date("2026-04-15"),
      assignedToId: null,
      notes: "Spare monitor for hot desks.",
    },
    {
      assetTag: "AS-1006",
      serialNumber: "SN-1006-PIX-6",
      category: "Laptop",
      brand: "Google",
      model: "Pixel 6",
      status: AssetStatus.RETIRED,
      location: "NYC HQ",
      purchaseDate: new Date("2021-05-01"),
      warrantyEnd: new Date("2023-05-01"),
      assignedToId: null,
      notes: "Retired QA device.",
    },
    {
      assetTag: "AS-1007",
      serialNumber: "SN-1007-HP-840",
      category: "Laptop",
      brand: "HP",
      model: "EliteBook 840",
      status: AssetStatus.ASSIGNED,
      location: "Remote",
      purchaseDate: new Date("2024-01-20"),
      warrantyEnd: new Date("2027-01-20"),
      assignedToId: personMap.get("Jamal Ortega"),
      notes: "Remote dev machine.",
    },
    {
      assetTag: "AS-1008",
      serialNumber: "SN-1008-IMAC-24",
      category: "Desktop",
      brand: "Apple",
      model: "iMac 24",
      status: AssetStatus.IN_STOCK,
      location: "NYC HQ",
      purchaseDate: new Date("2024-05-10"),
      warrantyEnd: new Date("2027-05-10"),
      assignedToId: null,
      notes: "Demo kiosk.",
    },
    {
      assetTag: "AS-1009",
      serialNumber: "SN-1009-MON-34",
      category: "Monitor",
      brand: "Dell",
      model: "UltraSharp 34",
      status: AssetStatus.IN_STOCK,
      location: "KL Office",
      purchaseDate: new Date("2024-02-20"),
      warrantyEnd: new Date("2026-02-20"),
      assignedToId: null,
      notes: "Ultrawide for engineering pod.",
    },
    {
      assetTag: "AS-1010",
      serialNumber: "SN-1010-IPAD-10",
      category: "iPad",
      brand: "Apple",
      model: "iPad 10",
      status: AssetStatus.ASSIGNED,
      location: "NYC HQ",
      imeiNumber: "303568745044000",
      deviceSpec: "128GB, Wi-Fi",
      accessories: "Case, Charger",
      purchaseDate: new Date("2024-03-12"),
      warrantyEnd: new Date("2026-03-12"),
      assignedToId: personMap.get("Sofia Reyes"),
      notes: "Product demo kit.",
    },
  ];

  await prisma.asset.deleteMany({ where: { workspaceId: workspace.id } });

  for (const asset of assets) {
    await prisma.asset.create({
      data: {
        workspaceId: workspace.id,
        ...asset,
      },
    });
  }

  console.log(`Seed complete. Admin ${email} with workspace "${workspace.name}" and sample data.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
