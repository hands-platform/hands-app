-- CreateTable
CREATE TABLE "AdminCalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "tags" JSONB,
    "url" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminCalendarEvent_startAt_idx" ON "AdminCalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "AdminCalendarEvent_authorId_startAt_idx" ON "AdminCalendarEvent"("authorId", "startAt");

-- CreateIndex
CREATE INDEX "AdminCalendarEvent_updatedAt_idx" ON "AdminCalendarEvent"("updatedAt");
