-- CreateEnum
CREATE TYPE "AiPlanStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AiActionPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "previewJson" JSONB NOT NULL,
    "status" "AiPlanStatus" NOT NULL DEFAULT 'PENDING',
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmationText" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiActionPlan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AiActionPlan" ADD CONSTRAINT "AiActionPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionPlan" ADD CONSTRAINT "AiActionPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
