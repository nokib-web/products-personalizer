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
    console.log("Proxy submission auth check fallback:", err);
  }

  try {
    const body = await request.json();
    const {
      designId,
      customizableProductId,
      designData,
      previewImageUrl,
      customerNote,
    } = body;

    if (!customizableProductId) {
      return json({ error: "Missing customizableProductId" }, { status: 400 });
    }

    const dataPayload = {
      shop: shop || "storefront",
      customizableProductId,
      designData: typeof designData === "string" ? designData : JSON.stringify(designData || {}),
      previewImageUrl: previewImageUrl || "",
      customerNote: customerNote || null,
      status: "PENDING",
    };

    let submission;
    if (designId) {
      const existing = await prisma.designSubmission.findUnique({ where: { id: designId } });
      if (existing) {
        submission = await prisma.designSubmission.update({
          where: { id: designId },
          data: dataPayload,
        });
      } else {
        submission = await prisma.designSubmission.create({
          data: { ...dataPayload, id: designId },
        });
      }
    } else {
      submission = await prisma.designSubmission.create({
        data: dataPayload,
      });
    }

    return json({
      success: true,
      designId: submission.id,
      status: submission.status,
    });
  } catch (error: any) {
    console.error("Error creating design submission:", error);
    return json({ error: error.message || "Failed to create design submission" }, { status: 500 });
  }
};
