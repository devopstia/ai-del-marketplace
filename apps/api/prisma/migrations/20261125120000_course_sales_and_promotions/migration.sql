-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('all', 'categories', 'courses');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "promoOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "listPriceCents" INTEGER,
ADD COLUMN     "saleId" TEXT,
ADD COLUMN     "saleKind" TEXT;

-- CreateTable
CREATE TABLE "course_sales" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "salePriceCents" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "canceledById" TEXT,
    "cancelNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentOff" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "scope" "PromotionScope" NOT NULL DEFAULT 'all',
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canceledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_sales_courseId_endsAt_idx" ON "course_sales"("courseId", "endsAt");

-- CreateIndex
CREATE INDEX "course_sales_startsAt_endsAt_idx" ON "course_sales"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "promotions_startsAt_endsAt_idx" ON "promotions"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "course_sales" ADD CONSTRAINT "course_sales_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

