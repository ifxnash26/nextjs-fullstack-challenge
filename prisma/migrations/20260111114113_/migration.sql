/*
  Warnings:

  - You are about to drop the column `vendor` on the `Asset` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "vendor",
ADD COLUMN     "accessories" TEXT,
ADD COLUMN     "deviceSpec" TEXT,
ADD COLUMN     "imeiNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");
