import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const submission = await prisma.designSubmission.findUnique({
    where: { id },
    select: { previewImageUrl: true },
  });

  if (!submission || !submission.previewImageUrl) {
    return new Response("Image not found", { status: 404 });
  }

  const base64String = submission.previewImageUrl.replace(/^data:image\/[a-z]+;base64,/, "");
  const imageBuffer = Buffer.from(base64String, "base64");

  return new Response(imageBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
