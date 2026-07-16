const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  await prisma.optionSetAssignment.updateMany({
    where: { isExclusion: true },
    data: { isExclusion: false }
  });
  console.log("Updated all assignments to NOT be exclusions.");
}
main().finally(() => prisma.$disconnect());
