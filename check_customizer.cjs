const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.customizableProduct.count();
  console.log("Customizable products count:", count);
  const products = await prisma.customizableProduct.findMany({ include: { options: true } });
  console.log("Products:", JSON.stringify(products, null, 2));
}
main().finally(() => prisma.$disconnect());
