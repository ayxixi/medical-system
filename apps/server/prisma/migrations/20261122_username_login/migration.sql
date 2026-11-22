ALTER TABLE "Account" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");
