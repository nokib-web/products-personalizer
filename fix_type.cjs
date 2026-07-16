const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.customizationOption.updateMany({
    where: { type: "FILE_UPLOAD" },
    data: { type: "IMAGE_UPLOAD" }
  });
  console.log("Updated options:", result.count);
}
main().finally(() => prisma.$disconnect());
