import prisma from "../app/db.server";

async function fixBrokenPreviews() {
  console.log("Checking submissions with broken or proxy previewImageUrl...");
  const submissions = await prisma.designSubmission.findMany();

  let count = 0;
  for (const s of submissions) {
    if (s.previewImageUrl && !s.previewImageUrl.startsWith("data:image/")) {
      try {
        if (s.designData) {
          const parsed = JSON.parse(s.designData);
          if (parsed.objects && Array.isArray(parsed.objects)) {
            const imgObj = parsed.objects.find((o: any) => o.type === "image" && o.src && o.src.startsWith("data:image/"));
            if (imgObj) {
              console.log(`Restoring previewImageUrl for ${s.id} from designData...`);
              await prisma.designSubmission.update({
                where: { id: s.id },
                data: {
                  previewImageUrl: imgObj.src,
                  hiResImageUrl: imgObj.src,
                },
              });
              count++;
            }
          }
        }
      } catch (err) {
        console.error(`Error fixing ${s.id}:`, err);
      }
    }
  }

  console.log(`Successfully repaired ${count} design submissions.`);
}

fixBrokenPreviews().finally(() => prisma.$disconnect());
