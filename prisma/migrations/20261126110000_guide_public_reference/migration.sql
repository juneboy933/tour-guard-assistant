ALTER TABLE "Guide" ADD COLUMN "publicReference" TEXT;

UPDATE "Guide"
SET "publicReference" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "publicReference" IS NULL;

ALTER TABLE "Guide" ALTER COLUMN "publicReference" SET NOT NULL;

CREATE UNIQUE INDEX "Guide_publicReference_key" ON "Guide"("publicReference");
