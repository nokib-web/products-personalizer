import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  let shop = url.searchParams.get("shop");

  try {
    const authResult = await authenticate.public.appProxy(request);
    if (authResult.session?.shop) {
      shop = authResult.session.shop;
    }
  } catch (err) {
    console.log("Proxy auth verification fallback:", err);
  }

  if (!productId) {
    return json({ error: "Missing productId parameter" }, { status: 400 });
  }

  const numericId = productId.split("/").pop() || productId;
  const gid = `gid://shopify/Product/${numericId}`;

  const customizableProduct = await prisma.customizableProduct.findFirst({
    where: {
      ...(shop ? { shop } : {}),
      shopifyProductId: {
        in: [numericId, gid, productId, "ALL"],
      },
      isActive: true,
    },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!customizableProduct) {
    return json({ active: false, customizableProduct: null });
  }

  return json({
    active: true,
    customizableProduct: {
      id: customizableProduct.id,
      shop: customizableProduct.shop,
      shopifyProductId: customizableProduct.shopifyProductId,
      title: customizableProduct.title,
      mockupImageUrl: customizableProduct.mockupImageUrl,
      options: customizableProduct.options.map((opt) => ({
        id: opt.id,
        type: opt.type,
        label: opt.label,
        required: opt.required,
        config: JSON.parse(opt.config || "{}"),
        printAreaX: opt.printAreaX,
        printAreaY: opt.printAreaY,
        printAreaWidth: opt.printAreaWidth,
        printAreaHeight: opt.printAreaHeight,
        sortOrder: opt.sortOrder,
      })),
    },
  });
};
