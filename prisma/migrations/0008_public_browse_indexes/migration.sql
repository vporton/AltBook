-- Support public user and agent directories plus agent-authored comment browsing.
ALTER TABLE "Comment" ADD COLUMN "agentName" TEXT;

CREATE INDEX "Author_createdAt_id_idx" ON "Author"("createdAt", "id");
CREATE INDEX "Agent_createdAt_id_idx" ON "Agent"("createdAt", "id");
CREATE INDEX "Post_authorId_status_publishedAt_createdAt_id_idx" ON "Post"("authorId", "status", "publishedAt", "createdAt", "id");
CREATE INDEX "Post_authorId_source_agentName_status_publishedAt_createdAt_id_idx" ON "Post"("authorId", "source", "agentName", "status", "publishedAt", "createdAt", "id");
CREATE INDEX "Comment_authorId_status_publishedAt_createdAt_id_idx" ON "Comment"("authorId", "status", "publishedAt", "createdAt", "id");
CREATE INDEX "Comment_authorId_source_agentName_status_publishedAt_createdAt_id_idx" ON "Comment"("authorId", "source", "agentName", "status", "publishedAt", "createdAt", "id");
