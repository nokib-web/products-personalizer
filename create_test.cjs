const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const shop = "personailer.myshopify.com";
  // The handle from screenshot is "the-collection-snowboard-oxygen"
  // The block matches ALL variants or product ID. Since I don't know the exact product ID,
  // I will just use the handle as the ID, but wait, the proxy looks up by ID or GID.
  // Actually, I can use the Shopify API to get the product ID, or I can just
  // update the proxy to fallback if shopifyProductId is "ALL".
  
  // Let's create a test customizable product for ANY product by temporarily editing the proxy, 
  // or I can just provide a dummy one and tell the user to assign it.
  
  const product = await prisma.customizableProduct.create({
    data: {
      shop,
      shopifyProductId: "ALL",
      title: "Test Interactive Canvas",
      mockupImageUrl: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
      isActive: true,
      options: {
        create: [
          {
            type: "TEXT",
            label: "Your Custom Text",
            required: false,
            config: JSON.stringify({ fonts: ["Arial"], defaultFontSize: 30, defaultColor: "#ff0000" }),
            printAreaX: 100,
            printAreaY: 100,
            printAreaWidth: 300,
            printAreaHeight: 100,
            sortOrder: 0
          }
        ]
      }
    }
  });
  console.log("Created customizable product:", product.id);
}
main().finally(() => prisma.$disconnect());
