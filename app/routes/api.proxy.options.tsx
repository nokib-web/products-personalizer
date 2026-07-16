import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let shop = null;
  let corsHeaders = {};

  try {
    const { session } = await authenticate.public.appProxy(request);
    if (session) {
      shop = session.shop;
    }
  } catch (error) {
    // Fallback if not hitting via app proxy (e.g., direct test)
    const url = new URL(request.url);
    shop = url.searchParams.get("shop");
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const collections = url.searchParams.getAll("collection");
  const tags = url.searchParams.getAll("tag");
  const vendor = url.searchParams.get("vendor");
  
  if (!shop || !productId) {
    return json({ error: "Missing shop or productId" }, { status: 400, headers: corsHeaders });
  }

  // Find all active option sets for this shop
  const optionSets = await prisma.optionSet.findMany({
    where: { shop, isActive: true },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
      },
      assignments: true,
    },
  });

  // Filter option sets based on assignments
  const applicableOptionSets = optionSets.filter((os) => {
    if (!os.assignments || os.assignments.length === 0) return false;

    let isIncluded = false;
    let isExcluded = false;

    for (const assignment of os.assignments) {
      const match = checkMatch(assignment, { productId, collections, tags, vendor });
      
      if (match) {
        if (assignment.isExclusion) {
          isExcluded = true;
        } else {
          isIncluded = true;
        }
      }
    }

    return isIncluded && !isExcluded;
  });

  return json({
    optionSets: applicableOptionSets,
  }, { headers: corsHeaders });
};

function checkMatch(assignment: any, productData: any) {
  const targetIdStr = String(assignment.targetId);
  const targetBareId = targetIdStr.includes("/") ? targetIdStr.split("/").pop() : targetIdStr;
  
  switch (assignment.type) {
    case "ALL_PRODUCTS":
      return true;
    case "PRODUCT":
      return targetBareId === String(productData.productId);
    case "COLLECTION":
      return productData.collections.some((c: string) => c === targetBareId);
    case "TAG":
      return productData.tags.includes(assignment.targetId);
    case "VENDOR":
      return assignment.targetId === productData.vendor;
    default:
      return false;
  }
}
