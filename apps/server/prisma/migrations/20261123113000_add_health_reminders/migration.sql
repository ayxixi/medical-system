CREATE TABLE "HealthReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "nextAt" DATETIME NOT NULL,
    "localTime" TEXT,
    "timeZone" TEXT NOT NULL,
    "repeatDaily" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HealthReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "HealthReminder_userId_isActive_nextAt_idx" ON "HealthReminder"("userId", "isActive", "nextAt");
