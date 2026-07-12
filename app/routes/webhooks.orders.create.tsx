import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { processOrderWebhook } from "../utils/customizer.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  try {
    await processOrderWebhook(payload, shop, topic);
  } catch (error) {
    console.error(`Error processing ${topic} webhook for ${shop}:`, error);
  }

  return new Response();
};
