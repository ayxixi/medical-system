CREATE TABLE "AttachmentCleanup" (
    "storageProvider" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "nextAttemptAt" BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY ("storageProvider", "relativePath")
);

CREATE INDEX "AttachmentCleanup_nextAttemptAt_idx" ON "AttachmentCleanup"("nextAttemptAt");
CREATE INDEX "VisitFile_storageProvider_relativePath_idx" ON "VisitFile"("storageProvider", "relativePath");

-- Cascades run this trigger too, in the same transaction as the delete.
CREATE TRIGGER "VisitFile_queue_deleted_object"
AFTER DELETE ON "VisitFile"
BEGIN
    INSERT OR IGNORE INTO "AttachmentCleanup" ("storageProvider", "relativePath")
    VALUES (OLD."storageProvider", OLD."relativePath");
END;

CREATE TRIGGER "VisitFile_queue_replaced_object"
AFTER UPDATE OF "storageProvider", "relativePath" ON "VisitFile"
WHEN OLD."storageProvider" <> NEW."storageProvider" OR OLD."relativePath" <> NEW."relativePath"
BEGIN
    INSERT OR IGNORE INTO "AttachmentCleanup" ("storageProvider", "relativePath")
    VALUES (OLD."storageProvider", OLD."relativePath");

    DELETE FROM "AttachmentCleanup"
    WHERE "storageProvider" = NEW."storageProvider" AND "relativePath" = NEW."relativePath";
END;

CREATE TRIGGER "VisitFile_clear_saved_object"
AFTER INSERT ON "VisitFile"
BEGIN
    DELETE FROM "AttachmentCleanup"
    WHERE "storageProvider" = NEW."storageProvider" AND "relativePath" = NEW."relativePath";
END;
