import { PrismaClient } from "@prisma/client";
import { processOrderWebhook } from "../app/utils/customizer.server";

const prisma = new PrismaClient();

async function runTest() {
  console.log("=== Starting Webhook Processing Test ===");

  let customizableProduct = await prisma.customizableProduct.findFirst({
    where: { shopifyProductId: "999999999" },
  });

  if (!customizableProduct) {
    customizableProduct = await prisma.customizableProduct.create({
      data: {
        shop: "test-shop.myshopify.com",
        shopifyProductId: "999999999",
        title: "Test T-Shirt",
        mockupImageUrl: "https://example.com/mockup.png",
        isActive: true,
      },
    });
  }

  const testDesignId = `design_test_${Date.now()}`;

  await prisma.designSubmission.create({
    data: {
      id: testDesignId,
      shop: "test-shop.myshopify.com",
      customizableProductId: customizableProduct.id,
      designData: JSON.stringify({ version: "5.3.1", objects: [] }),
      previewImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      status: "PENDING",
    },
  });

  console.log(`Created test DesignSubmission: [${testDesignId}] with status PENDING`);

  const mockOrderPayload = {
    id: 820982911946154508,
    admin_graphql_api_id: "gid://shopify/Order/820982911946154508",
    name: "#1001",
    line_items: [
      {
        id: 866550311766439020,
        admin_graphql_api_id: "gid://shopify/LineItem/866550311766439020",
        properties: [
          {
            name: "_customizer_design_id",
            value: testDesignId,
          },
          {
            name: "_preview_image",
            value: `/apps/customizer/image?id=${testDesignId}`,
          },
        ],
      },
    ],
  };

  await processOrderWebhook(mockOrderPayload, "test-shop.myshopify.com", "orders/create");

  const updatedSubmission = await prisma.designSubmission.findUnique({
    where: { id: testDesignId },
  });

  if (!updatedSubmission) {
    throw new Error("DesignSubmission not found after update!");
  }

  console.log("=== Test Verification Results ===");
  console.log("Submission ID:", updatedSubmission.id);
  console.log("Updated Status:", updatedSubmission.status);
  console.log("Linked Order ID:", updatedSubmission.shopifyOrderId);
  console.log("Linked Line Item ID:", updatedSubmission.shopifyLineItemId);
  console.log("HiRes Image URL:", updatedSubmission.hiResImageUrl);

  if (updatedSubmission.status === "ORDERED" && updatedSubmission.shopifyOrderId === "820982911946154508") {
    console.log("✔ TEST PASSED: DesignSubmission successfully transitioned to ORDERED with correct order links!");
  } else {
    console.error("❌ TEST FAILED: Status or order ID mismatch.");
  }

  await prisma.$disconnect();
}

runTest().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
