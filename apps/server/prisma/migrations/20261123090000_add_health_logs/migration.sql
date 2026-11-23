CREATE TABLE "HealthLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" REAL,
    "medicineName" TEXT,
    "dosage" TEXT,
    "symptoms" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HealthLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "HealthLog_userId_occurredAt_idx" ON "HealthLog"("userId", "occurredAt");
CREATE INDEX "HealthLog_userId_type_occurredAt_idx" ON "HealthLog"("userId", "type", "occurredAt");
