ALTER TABLE "HealthReminder" ADD COLUMN "visitId" TEXT REFERENCES "Visit" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "HealthReminder_visitId_idx" ON "HealthReminder"("visitId");
