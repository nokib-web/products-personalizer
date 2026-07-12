import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  let shop = url.searchParams.get("shop");

  try {
    const authResult = await authenticate.public.appProxy(request);
    if (authResult.session?.shop) {
      shop = authResult.session.shop;
    }
  } catch (err) {
    console.log("Proxy preview auth check fallback:", err);
  }

  try {
    const body = await request.json();
    const { imageDataUrl, customizableProductId } = body;

    if (!imageDataUrl || !customizableProductId) {
      return json({ error: "Missing imageDataUrl or customizableProductId" }, { status: 400 });
    }

    const submission = await prisma.designSubmission.create({
      data: {
        shop: shop || "storefront",
        customizableProductId: customizableProductId,
        designData: "{}",
        previewImageUrl: imageDataUrl,
        status: "PREVIEW",
      },
    });

    const hostedUrl = `/apps/customizer/image?id=${submission.id}`;

    return json({
      previewId: submission.id,
      previewImageUrl: hostedUrl,
    });
  } catch (error: any) {
    console.error("Error in proxy preview upload:", error);
    return json({ error: error.message || "Failed to upload preview image" }, { status: 500 });
  }
};
