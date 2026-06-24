ALTER TABLE "Agent" ADD COLUMN "authorId" TEXT;

UPDATE "Agent"
SET "authorId" = (
  SELECT "id"
  FROM "Author"
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
)
WHERE "authorId" IS NULL;

ALTER TABLE "Agent" ALTER COLUMN "authorId" SET NOT NULL;

CREATE INDEX "Agent_authorId_createdAt_idx" ON "Agent"("authorId", "createdAt");

ALTER TABLE "Agent"
ADD CONSTRAINT "Agent_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "Author"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
