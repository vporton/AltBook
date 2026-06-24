ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT;

CREATE INDEX "Comment_parentId_status_publishedAt_idx" ON "Comment"("parentId", "status", "publishedAt");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
