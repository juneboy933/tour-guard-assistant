ALTER TABLE "Report" ADD COLUMN "publicReference" TEXT;
UPDATE "Report"
SET "publicReference" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "publicReference" IS NULL;
ALTER TABLE "Report" ALTER COLUMN "publicReference" SET NOT NULL;
CREATE UNIQUE INDEX "Report_publicReference_key" ON "Report"("publicReference");
