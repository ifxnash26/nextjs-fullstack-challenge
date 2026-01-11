const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  try {
    const people = await prisma.person.findMany({
      select: { id: true, name: true, email: true, title: true },
      orderBy: { name: "asc" },
    });
    console.log(JSON.stringify(people, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
