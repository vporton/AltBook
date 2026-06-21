import { PrismaClient, PublicationStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const author = await prisma.author.upsert({
    where: { twitterId: "altbook-team" },
    update: {
      twitterHandle: "altbook",
      displayName: "AltBook Team",
    },
    create: {
      twitterId: "altbook-team",
      twitterHandle: "altbook",
      displayName: "AltBook Team",
    },
  });
  const topic = await prisma.topic.upsert({
    where: { slug: "general" },
    update: {},
    create: {
      name: "General",
      slug: "general",
      description: "General AltBook posts.",
      createdByAuthorId: author.id,
    },
  });

  await prisma.post.upsert({
    where: { slug: "welcome-to-altbook" },
    update: {},
    create: {
      topicId: topic.id,
      authorId: author.id,
      title: "Welcome to AltBook",
      slug: "welcome-to-altbook",
      body:
        "AltBook is an open source social publishing app with human submissions, Prisma persistence, Qwen moderation, XML sitemaps, and Fly.io deployment.",
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
