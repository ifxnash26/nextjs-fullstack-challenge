/* eslint-disable no-console */
const { PrismaClient, Role } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "adminadmin";
  const workspaceName = process.env.SEED_WORKSPACE_NAME || "AssetSpace";

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      hashedPassword,
      role: Role.ADMIN,
    },
  });

  let workspace = await prisma.workspace.findFirst({ where: { name: workspaceName } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: workspaceName,
        ownerId: admin.id,
      },
    });
  }

  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: admin.id,
        workspaceId: workspace.id,
      },
    },
    update: { role: Role.ADMIN },
    create: {
      userId: admin.id,
      workspaceId: workspace.id,
      role: Role.ADMIN,
    },
  });

  console.log(`Seed complete. Admin ${email} with workspace "${workspace.name}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
