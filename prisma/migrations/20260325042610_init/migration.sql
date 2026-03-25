-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prNumber" INTEGER NOT NULL,
    "prTitle" TEXT NOT NULL,
    "prUrl" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issues" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "toolCalls" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "repo" TEXT NOT NULL DEFAULT '',
    "slackChannel" TEXT NOT NULL DEFAULT ''
);
