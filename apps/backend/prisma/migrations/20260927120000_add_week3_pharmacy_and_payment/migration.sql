-- AlterTable Prescription: Add status with default PRESCRIBED
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PRESCRIBED';
CREATE INDEX IF NOT EXISTS "Prescription_status_idx" ON "Prescription"("status");

-- AlterTable PrescriptionItem: Add dispensedQuantity with default 0
ALTER TABLE "PrescriptionItem" ADD COLUMN IF NOT EXISTS "dispensedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Medicine: Add isActive with default true
ALTER TABLE "Medicine" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "Medicine_hospitalId_idx" ON "Medicine"("hospitalId");
CREATE INDEX IF NOT EXISTS "Medicine_isActive_idx" ON "Medicine"("isActive");

-- CreateTable Payment
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "method" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS "Payment_hospitalId_idx" ON "Payment"("hospitalId");
CREATE INDEX IF NOT EXISTS "Payment_gatewayOrderId_idx" ON "Payment"("gatewayOrderId");
CREATE INDEX IF NOT EXISTS "Payment_gatewayPaymentId_idx" ON "Payment"("gatewayPaymentId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Payment_invoiceId_fkey'
    ) THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Payment_hospitalId_fkey'
    ) THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
