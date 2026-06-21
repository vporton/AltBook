import { PrismaClient, PublicationStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  await prisma.post.upsert({
    where: { slug: "welcome-to-altbook" },
    update: {},
    create: {
      title: "Welcome to AltBook",
      slug: "welcome-to-altbook",
      body:
        "AltBook is an open source social publishing app with human submissions, Prisma persistence, Qwen moderation, XML sitemaps, and Fly.io deployment.",
      authorName: "AltBook Team",
      status: PublicationStatus.APPROVED,
      links: [],
      publishedAt: now,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
