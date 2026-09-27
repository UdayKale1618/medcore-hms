-- AlterTable
ALTER TABLE "LabTest" ADD COLUMN "hospitalId" TEXT;

-- CreateIndex
CREATE INDEX "LabTest_hospitalId_idx" ON "LabTest"("hospitalId");

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "appointmentId" DROP NOT NULL;
