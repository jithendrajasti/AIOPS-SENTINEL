-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SRE',
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "assignedTo" TEXT NOT NULL DEFAULT 'AI Engine',
    "environment" TEXT NOT NULL DEFAULT 'Production',
    "rootCause" TEXT NOT NULL,
    "suggestedFix" TEXT NOT NULL DEFAULT '',
    "confidence" INTEGER NOT NULL,
    "affectedSystems" TEXT NOT NULL,
    "similarCount" INTEGER NOT NULL DEFAULT 0,
    "impactedUsers" INTEGER NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anomalyId" TEXT,
    "recentLogs" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldenRecord" (
    "id" TEXT NOT NULL,
    "pineconeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoldenRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_code_key" ON "Incident"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GoldenRecord_pineconeId_key" ON "GoldenRecord"("pineconeId");
