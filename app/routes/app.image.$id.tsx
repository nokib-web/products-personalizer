import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { id } = params;

  if (!id) {
    return new Response("Missing submission id parameter", { status: 400 });
  }

  const submission = await prisma.designSubmission.findUnique({
    where: { id },
    select: { previewImageUrl: true, hiResImageUrl: true, designData: true },
  });

  if (!submission) {
    return new Response("Submission not found", { status: 404 });
  }

  let base64Target = submission.previewImageUrl || "";
  let contentType = "image/png";

  if (!base64Target.startsWith("data:image/")) {
    try {
      if (submission.designData) {
        const parsed = JSON.parse(submission.designData);
        if (parsed.objects && Array.isArray(parsed.objects)) {
          const imgObj = parsed.objects.find((o: any) => o.type === "image" && o.src && o.src.startsWith("data:image/"));
          if (imgObj) {
            base64Target = imgObj.src;
          }
        }
      }
    } catch (err) {
      console.error("Error parsing designData for fallback image:", err);
    }
  }

  if (base64Target.startsWith("data:image/")) {
    const match = base64Target.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (match && match[1]) {
      contentType = match[1];
    }
    const base64String = base64Target.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    const imageBuffer = Buffer.from(base64String, "base64");

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response("Image format require direct base64 storage", { status: 404 });
};
