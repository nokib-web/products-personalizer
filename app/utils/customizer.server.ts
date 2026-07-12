import prisma from "../db.server";

/**
 * Utility function to generate a high-resolution production image (e.g. 3000px wide)
 * from Fabric.js canvas JSON designData.
 */
export async function generateHiResImage(designData: string, previewImageUrl: string): Promise<string> {
  // TODO: Implement server-side headless Fabric.js or node-canvas rendering at 3000x3000px resolution.
  // Example future headless rendering pipeline:
  // 1. const canvas = new fabric.StaticCanvas(null, { width: 3000, height: 3000 });
  // 2. await canvas.loadFromJSON(designData);
  // 3. const buffer = canvas.toBuffer('image/png');
  // 4. const uploadedUrl = await uploadToCloudStorage(buffer, 'hires/design.png');
  // return uploadedUrl;

  console.log("Generating high-resolution image stub using preview image as placeholder...");
  return previewImageUrl;
}

/**
 * Helper to extract property values from a Shopify order line item.
 */
export function getLineItemProperty(lineItem: any, propName: string): string | null {
  if (!lineItem || !lineItem.properties) return null;

  if (Array.isArray(lineItem.properties)) {
    const found = lineItem.properties.find(
      (p: any) => p?.name === propName || p?.key === propName
    );
    return found?.value ? String(found.value) : null;
  }

  if (typeof lineItem.properties === "object") {
    return lineItem.properties[propName] ? String(lineItem.properties[propName]) : null;
  }

  return null;
}

/**
 * Helper to extract exact numeric ID string from Shopify item (order or line item),
 * preferring admin_graphql_api_id to avoid JS floating point precision loss on 64-bit integers.
 */
export function extractShopifyId(item: any): string {
  if (!item) return "";
  if (typeof item.admin_graphql_api_id === "string") {
    const parts = item.admin_graphql_api_id.split("/");
    return parts[parts.length - 1];
  }
  if (item.id !== undefined && item.id !== null) {
    return String(item.id);
  }
  return "";
}

/**
 * Shared order processing logic for orders/create and orders/paid webhooks.
 */
export async function processOrderWebhook(payload: any, shop: string, topic: string) {
  const orderId = extractShopifyId(payload);
  console.log(`[Webhook] Processing ${topic} for shop ${shop}, order ID: ${orderId}`);
  const lineItems = payload.line_items || [];

  if (lineItems.length === 0) {
    console.log(`[Webhook] Order ${orderId} has no line items.`);
    return;
  }

  for (const lineItem of lineItems) {
    const designId = getLineItemProperty(lineItem, "_customizer_design_id");
    if (!designId) continue;

    const lineItemId = extractShopifyId(lineItem);
    console.log(`[Webhook] Found _customizer_design_id [${designId}] on line item [${lineItemId}]`);


    try {
      const submission = await prisma.designSubmission.findUnique({
        where: { id: designId },
      });

      if (!submission) {
        console.warn(
          `[Webhook] WARN: DesignSubmission with ID "${designId}" not found in database for order "${orderId}", line item "${lineItemId}". Customer design may not have been saved or ID got corrupted.`
        );
        continue;
      }

      const hiResUrl = await generateHiResImage(submission.designData, submission.previewImageUrl);

      await prisma.designSubmission.update({
        where: { id: designId },
        data: {
          shopifyOrderId: orderId,
          shopifyLineItemId: lineItemId,
          status: "ORDERED",
          hiResImageUrl: hiResUrl,
        },
      });

      console.log(
        `[Webhook] SUCCESS: DesignSubmission [${designId}] updated to ORDERED. Order: [${orderId}], LineItem: [${lineItemId}], HiRes: [${hiResUrl}]`
      );
    } catch (err) {
      console.error(`[Webhook] ERROR updating DesignSubmission [${designId}] for order [${orderId}]:`, err);
      // We log clearly for debugging and continue processing other items without throwing to avoid webhook retry loops
    }
  }
}
