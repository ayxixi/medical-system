-- Add Account table and link User to Account.
-- DEV-ONLY migration: existing User rows (and dependent Visit/Record/Medication/VisitFile rows)
-- are cleared because they cannot be associated with an Account.

PRAGMA foreign_keys=OFF;

DELETE FROM "VisitFile";
DELETE FROM "Medication";
DELETE FROM "DiagnosisRecord";
DELETE FROM "Visit";

CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

DROP TABLE "User";

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "User_accountId_idx" ON "User"("accountId");

PRAGMA foreign_keys=ON;
