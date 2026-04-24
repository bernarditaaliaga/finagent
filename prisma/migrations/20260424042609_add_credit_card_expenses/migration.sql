-- CreateTable
CREATE TABLE "CreditCardExpense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "installmentAmount" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "billingStartMonth" INTEGER NOT NULL,
    "billingStartYear" INTEGER NOT NULL,
    "categoryId" TEXT,
    "creditCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardExpense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CreditCardExpense" ADD CONSTRAINT "CreditCardExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardExpense" ADD CONSTRAINT "CreditCardExpense_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
