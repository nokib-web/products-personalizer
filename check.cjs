const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.optionSet.count();
  console.log("Option sets count:", count);
  const sets = await prisma.optionSet.findMany({ include: { assignments: true } });
  console.log("Option sets:", JSON.stringify(sets, null, 2));
}
main().finally(() => prisma.$disconnect());
