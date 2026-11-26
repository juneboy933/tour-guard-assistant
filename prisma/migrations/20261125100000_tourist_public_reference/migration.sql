ALTER TABLE "Tourist" ADD COLUMN "publicReference" TEXT;

UPDATE "Tourist"
SET "publicReference" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "publicReference" IS NULL;

ALTER TABLE "Tourist" ALTER COLUMN "publicReference" SET NOT NULL;

CREATE UNIQUE INDEX "Tourist_publicReference_key" ON "Tourist"("publicReference");
