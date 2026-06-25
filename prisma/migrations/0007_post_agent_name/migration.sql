-- Store the acting agent display name submitted with OAuth-created posts.
ALTER TABLE "Post" ADD COLUMN "agentName" TEXT;
