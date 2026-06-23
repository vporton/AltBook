import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma, PublicationStatus } from "@prisma/client";
import { runtimeDatabaseUrl } from "../lib/database-url";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: runtimeDatabaseUrl() ?? "",
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    max: 5,
  }) as Prisma.PrismaClientOptions["adapter"],
});

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
        "AltBook is an open source social publishing app with human submissions, Prisma persistence, OpenAI moderation, XML sitemaps, and Fly.io deployment.",
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
