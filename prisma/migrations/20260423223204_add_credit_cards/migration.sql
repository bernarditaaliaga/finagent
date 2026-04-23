-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastFourDigits" TEXT,
    "cupoTotal" DOUBLE PRECISION NOT NULL,
    "deudaActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "facturadoMes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pagadoMes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingCloseDay" INTEGER NOT NULL DEFAULT 26,
    "isTitular" BOOLEAN NOT NULL DEFAULT true,
    "fintocId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCard_fintocId_key" ON "CreditCard"("fintocId");
