
-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "positionTitle" TEXT,
    "quota" INTEGER,
    "educationLevel" TEXT,
    "summary" TEXT,
    "requirements" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "applicationUrl" TEXT,
    "applicationStartAt" TIMESTAMP(3),
    "applicationEndAt" TIMESTAMP(3),
    "announcedAt" TIMESTAMP(3),
    "sourceCheckedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_status_applicationEndAt_idx"
ON "Announcement"("status", "applicationEndAt");

-- CreateIndex
CREATE INDEX "Announcement_organization_city_idx"
ON "Announcement"("organization", "city");

-- CreateIndex
CREATE INDEX "Announcement_announcedAt_idx"
ON "Announcement"("announcedAt");
