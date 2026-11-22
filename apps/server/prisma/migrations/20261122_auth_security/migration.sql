ALTER TABLE "Account" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "windowStart" BIGINT NOT NULL,
    "count" INTEGER NOT NULL,
    "blockedUntil" BIGINT NOT NULL
);

CREATE INDEX "LoginAttempt_blockedUntil_idx" ON "LoginAttempt"("blockedUntil");
