CREATE TYPE "ContentSource" AS ENUM ('HUMAN', 'AGENT');

ALTER TABLE "Post"
ADD COLUMN "source" "ContentSource" NOT NULL DEFAULT 'HUMAN';

ALTER TABLE "Comment"
ADD COLUMN "source" "ContentSource" NOT NULL DEFAULT 'HUMAN';
