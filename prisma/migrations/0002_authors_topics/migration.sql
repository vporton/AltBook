CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "twitterId" TEXT NOT NULL,
    "twitterHandle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdByAuthorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Author_twitterId_key" ON "Author"("twitterId");
CREATE UNIQUE INDEX "Author_twitterHandle_key" ON "Author"("twitterHandle");
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");
CREATE INDEX "Topic_createdAt_idx" ON "Topic"("createdAt");
CREATE INDEX "Topic_createdByAuthorId_idx" ON "Topic"("createdByAuthorId");

INSERT INTO "Author" ("id", "twitterId", "twitterHandle", "displayName", "createdAt", "updatedAt")
SELECT
    'legacy_author_' || md5("authorName"),
    'legacy:' || md5("authorName"),
    'legacy_' || substring(md5("authorName") from 1 for 20),
    "authorName",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT "authorName" FROM "Post"
    UNION
    SELECT "authorName" FROM "Comment"
) AS "LegacyAuthors"
ON CONFLICT ("twitterId") DO NOTHING;

INSERT INTO "Topic" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES (
    'topic_general',
    'General',
    'general',
    'Default topic for posts created before topic support existed.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

ALTER TABLE "Post" ADD COLUMN "topicId" TEXT;
ALTER TABLE "Post" ADD COLUMN "authorId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "authorId" TEXT;

UPDATE "Post"
SET
    "topicId" = 'topic_general',
    "authorId" = 'legacy_author_' || md5("authorName");

UPDATE "Comment"
SET "authorId" = 'legacy_author_' || md5("authorName");

ALTER TABLE "Post" ALTER COLUMN "topicId" SET NOT NULL;
ALTER TABLE "Post" ALTER COLUMN "authorId" SET NOT NULL;
ALTER TABLE "Comment" ALTER COLUMN "authorId" SET NOT NULL;

ALTER TABLE "Post" DROP COLUMN "authorName";
ALTER TABLE "Post" DROP COLUMN "authorEmailHash";
ALTER TABLE "Comment" DROP COLUMN "authorName";
ALTER TABLE "Comment" DROP COLUMN "authorEmailHash";

CREATE INDEX "Post_topicId_status_publishedAt_idx" ON "Post"("topicId", "status", "publishedAt");
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

ALTER TABLE "Topic" ADD CONSTRAINT "Topic_createdByAuthorId_fkey" FOREIGN KEY ("createdByAuthorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
