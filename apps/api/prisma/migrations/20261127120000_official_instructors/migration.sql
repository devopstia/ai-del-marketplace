ALTER TABLE "instructor_profiles" ADD COLUMN "official" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "officialSince" TIMESTAMP(3);
